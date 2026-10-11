// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../HH2Staking.sol";

interface Vm {
    function warp(uint256 timestamp) external;
    function prank(address sender) external;
    function expectRevert(bytes4 revertData) external;
    function expectRevert(bytes calldata revertData) external;
    function expectEmit(bool checkTopic1, bool checkTopic2, bool checkTopic3, bool checkData, address emitter) external;
}

/// @dev Minimal ERC-20 test double. HH2 staking amounts are denominated in 18-decimal units.
contract MockHH2Token {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    uint256 public feeBps;
    address public reentryTarget;
    bool public reentryAttempted;
    bool public reentrySucceeded;

    function mint(address account, uint256 amount) external {
        balanceOf[account] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function setFeeBps(uint256 fee) external {
        feeBps = fee;
    }

    function setReentryTarget(address target) external {
        reentryTarget = target;
        reentryAttempted = false;
        reentrySucceeded = false;
    }

    function transfer(address recipient, uint256 amount) external returns (bool) {
        if (balanceOf[msg.sender] < amount) return false;
        balanceOf[msg.sender] -= amount;
        balanceOf[recipient] += amount;
        return true;
    }

    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool) {
        if (balanceOf[sender] < amount || allowance[sender][msg.sender] < amount) return false;

        allowance[sender][msg.sender] -= amount;
        balanceOf[sender] -= amount;
        uint256 fee = amount * feeBps / 10_000;
        balanceOf[recipient] += amount - fee;

        if (reentryTarget != address(0) && !reentryAttempted) {
            reentryAttempted = true;
            (reentrySucceeded,) = reentryTarget.call(
                abi.encodeWithSelector(HH2Staking.stake.selector, uint8(0), 200 ether, uint256(1))
            );
        }
        return true;
    }
}

contract HH2StakingTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    event Staked(
        address indexed account,
        uint256 indexed stakeId,
        uint8 tierId,
        uint256 amount,
        uint256 unlocksAt,
        uint256 fid
    );
    event Withdrawn(address indexed account, uint256 indexed stakeId, uint256 amount, uint256 fid);

    address private constant ALICE = address(0xA11CE);
    address private constant BOB = address(0xB0B);
    uint256 private constant FID = 123_456;

    MockHH2Token private token;
    HH2Staking private staking;

    function setUp() public {
        token = new MockHH2Token();
        staking = new HH2Staking(address(token));
        token.mint(ALICE, 100_000 ether);
    }

    function test_constructorRejectsZeroToken() public {
        vm.expectRevert(HH2Staking.InvalidToken.selector);
        new HH2Staking(address(0));
    }

    function test_stakesAtEveryTierBoundaryAndMovesExactTokensIntoEscrow() public {
        uint8[3] memory tiers = [uint8(0), 1, 2];
        uint256[3] memory minimums = [uint256(200 ether), 500 ether, 1_000 ether];
        uint256[3] memory maximums = [uint256(5_000 ether), 10_000 ether, 20_000 ether];

        uint256 expectedStakeId = 1;
        for (uint256 i; i < tiers.length; i++) {
            _approve(ALICE, minimums[i]);
            vm.prank(ALICE);
            uint256 minStakeId = staking.stake(tiers[i], minimums[i], FID);
            _assertStake(ALICE, minStakeId, minimums[i], tiers[i], FID);
            require(minStakeId == expectedStakeId++, "unexpected minimum stake id");

            _approve(ALICE, maximums[i]);
            vm.prank(ALICE);
            uint256 maxStakeId = staking.stake(tiers[i], maximums[i], FID);
            _assertStake(ALICE, maxStakeId, maximums[i], tiers[i], FID);
            require(maxStakeId == expectedStakeId++, "unexpected maximum stake id");
        }

        require(token.balanceOf(address(staking)) == 36_700 ether, "escrow balance mismatch");
        require(token.balanceOf(ALICE) == 63_300 ether, "wallet balance mismatch");
    }

    function test_rejectsInvalidTierZeroFidAndAmountsOutsideTierBounds() public {
        _expectStakeRevert(3, 200 ether, FID, HH2Staking.InvalidTier.selector);
        _expectStakeRevert(0, 200 ether, 0, HH2Staking.InvalidAmount.selector);
        _expectStakeRevert(0, 0, FID, HH2Staking.InvalidAmount.selector);

        uint8[3] memory tiers = [uint8(0), 1, 2];
        uint256[3] memory minimums = [uint256(200 ether), 500 ether, 1_000 ether];
        uint256[3] memory maximums = [uint256(5_000 ether), 10_000 ether, 20_000 ether];
        for (uint256 i; i < tiers.length; i++) {
            _expectStakeRevert(tiers[i], minimums[i] - 1, FID, HH2Staking.InvalidAmount.selector);
            _expectStakeRevert(tiers[i], maximums[i] + 1, FID, HH2Staking.InvalidAmount.selector);
        }

        require(staking.nextStakeId() == 1, "invalid stakes consumed ids");
        require(token.balanceOf(address(staking)) == 0, "invalid stake moved tokens");
    }

    function test_emitsEventsConsumedByTheAppLedger() public {
        uint256 amount = 200 ether;
        uint256 unlocksAt = block.timestamp + 30 days;
        _approve(ALICE, amount);

        vm.expectEmit(true, true, false, true, address(staking));
        emit Staked(ALICE, 1, 0, amount, unlocksAt, FID);
        vm.prank(ALICE);
        staking.stake(0, amount, FID);

        vm.warp(unlocksAt);
        vm.expectEmit(true, true, false, true, address(staking));
        emit Withdrawn(ALICE, 1, amount, FID);
        vm.prank(ALICE);
        staking.withdraw(1, FID);
    }

    function test_stakeRequiresSufficientAllowanceAndBalance() public {
        vm.expectRevert(HH2Staking.TransferFailed.selector);
        vm.prank(ALICE);
        staking.stake(0, 200 ether, FID);

        _approve(ALICE, 200 ether - 1);
        vm.expectRevert(HH2Staking.TransferFailed.selector);
        vm.prank(ALICE);
        staking.stake(0, 200 ether, FID);

        _approve(ALICE, 200 ether);
        vm.prank(ALICE);
        token.transfer(address(0xDEAD), token.balanceOf(ALICE));
        vm.expectRevert(HH2Staking.TransferFailed.selector);
        vm.prank(ALICE);
        staking.stake(0, 200 ether, FID);
    }

    function test_feeOnTransferTokenIsRejectedAtomically() public {
        token.setFeeBps(100);
        _approve(ALICE, 200 ether);
        vm.expectRevert(HH2Staking.TransferFailed.selector);
        vm.prank(ALICE);
        staking.stake(0, 200 ether, FID);

        require(token.balanceOf(ALICE) == 100_000 ether, "failed stake changed wallet balance");
        require(token.balanceOf(address(staking)) == 0, "failed stake left tokens in escrow");
        require(staking.nextStakeId() == 1, "failed stake consumed an id");
    }

    function test_reentrancyAttemptDuringTransferFromIsRejected() public {
        token.setReentryTarget(address(staking));
        _approve(ALICE, 200 ether);
        vm.prank(ALICE);
        uint256 stakeId = staking.stake(0, 200 ether, FID);

        require(stakeId == 1, "outer stake failed");
        require(token.reentryAttempted(), "mock did not attempt reentry");
        require(!token.reentrySucceeded(), "reentrant stake unexpectedly succeeded");
        require(staking.nextStakeId() == 2, "reentrant call consumed a stake id");
    }

    function test_withdrawRejectsUnknownCallerAndMismatchedFid() public {
        uint256 stakeId = _stake(ALICE, 0, 200 ether, FID);
        (, uint64 unlocksAt,,,) = staking.stakes(ALICE, stakeId);
        vm.warp(unlocksAt);

        vm.expectRevert(HH2Staking.StakeNotFound.selector);
        vm.prank(BOB);
        staking.withdraw(stakeId, FID);

        vm.expectRevert(HH2Staking.StakeNotFound.selector);
        vm.prank(ALICE);
        staking.withdraw(stakeId, FID + 1);

        require(token.balanceOf(ALICE) == 99_800 ether, "invalid withdrawal moved tokens");
    }

    function test_withdrawRejectsEarlyThenReturnsTokensAtExactMaturity() public {
        uint256 amount = 500 ether;
        uint256 stakeId = _stake(ALICE, 1, amount, FID);
        (, uint64 unlocksAt,,,) = staking.stakes(ALICE, stakeId);

        vm.warp(uint256(unlocksAt) - 1);
        vm.expectRevert(abi.encodeWithSelector(HH2Staking.StillLocked.selector, unlocksAt));
        vm.prank(ALICE);
        staking.withdraw(stakeId, FID);
        require(token.balanceOf(ALICE) == 100_000 ether - amount, "early withdrawal moved tokens");

        vm.warp(unlocksAt);
        vm.prank(ALICE);
        staking.withdraw(stakeId, FID);

        (uint128 storedAmount,,, , bool withdrawn) = staking.stakes(ALICE, stakeId);
        require(storedAmount == amount && withdrawn, "stake not marked withdrawn");
        require(token.balanceOf(ALICE) == 100_000 ether, "withdrawal did not return full amount");
        require(token.balanceOf(address(staking)) == 0, "escrow retained withdrawn tokens");
    }

    function test_withdrawCannotBeRepeated() public {
        uint256 stakeId = _stake(ALICE, 0, 200 ether, FID);
        (, uint64 unlocksAt,,,) = staking.stakes(ALICE, stakeId);
        vm.warp(unlocksAt);

        vm.prank(ALICE);
        staking.withdraw(stakeId, FID);
        vm.expectRevert(HH2Staking.StakeNotFound.selector);
        vm.prank(ALICE);
        staking.withdraw(stakeId, FID);
    }

    function _approve(address user, uint256 amount) private {
        vm.prank(user);
        token.approve(address(staking), amount);
    }

    function _stake(address user, uint8 tier, uint256 amount, uint256 fid) private returns (uint256 stakeId) {
        _approve(user, amount);
        vm.prank(user);
        stakeId = staking.stake(tier, amount, fid);
    }

    function _expectStakeRevert(uint8 tier, uint256 amount, uint256 fid, bytes4 selector) private {
        _approve(ALICE, amount);
        vm.expectRevert(selector);
        vm.prank(ALICE);
        staking.stake(tier, amount, fid);
    }

    function _assertStake(address user, uint256 stakeId, uint256 amount, uint8 tier, uint256 fid) private view {
        (uint128 storedAmount, uint64 unlocksAt, uint8 storedTier, uint256 storedFid, bool withdrawn) = staking.stakes(user, stakeId);
        require(storedAmount == amount, "wrong stored amount");
        require(unlocksAt == block.timestamp + _lockSeconds(tier), "wrong unlock timestamp");
        require(storedTier == tier, "wrong tier");
        require(storedFid == fid, "wrong FID");
        require(!withdrawn, "new stake is withdrawn");
    }

    function _lockSeconds(uint8 tier) private pure returns (uint256) {
        if (tier == 0) return 30 days;
        if (tier == 1) return 90 days;
        return 180 days;
    }
}
