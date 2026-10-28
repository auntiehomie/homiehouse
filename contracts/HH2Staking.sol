// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20HH2 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @notice Non-upgradeable HH2 escrow. Users stake their own HH2 and can
/// withdraw it after the selected lock period. There is no owner or admin key.
contract HH2Staking {
    IERC20HH2 public immutable token;
    uint256 public nextStakeId = 1;
    bool private entered;

    struct Stake {
        uint128 amount;
        uint64 unlocksAt;
        uint8 tierId;
        uint256 fid;
        bool withdrawn;
    }

    mapping(address => mapping(uint256 => Stake)) public stakes;

    event Staked(
        address indexed account,
        uint256 indexed stakeId,
        uint8 tierId,
        uint256 amount,
        uint256 unlocksAt,
        uint256 fid
    );
    event Withdrawn(address indexed account, uint256 indexed stakeId, uint256 amount, uint256 fid);

    error InvalidToken();
    error InvalidTier();
    error InvalidAmount();
    error ReentrantCall();
    error StakeNotFound();
    error StillLocked(uint256 unlocksAt);
    error TransferFailed();

    constructor(address hh2Token) {
        if (hh2Token == address(0)) revert InvalidToken();
        token = IERC20HH2(hh2Token);
    }

    modifier nonReentrant() {
        if (entered) revert ReentrantCall();
        entered = true;
        _;
        entered = false;
    }

    function stake(uint8 tierId, uint256 amount, uint256 fid) external nonReentrant returns (uint256 stakeId) {
        uint256 minAmount;
        uint256 maxAmount;
        uint256 lockSeconds;
        if (tierId == 0) {
            minAmount = 200 ether; maxAmount = 5_000 ether; lockSeconds = 30 days;
        } else if (tierId == 1) {
            minAmount = 500 ether; maxAmount = 10_000 ether; lockSeconds = 90 days;
        } else if (tierId == 2) {
            minAmount = 1_000 ether; maxAmount = 20_000 ether; lockSeconds = 180 days;
        } else {
            revert InvalidTier();
        }
        if (fid == 0 || amount < minAmount || amount > maxAmount || amount > type(uint128).max) revert InvalidAmount();

        stakeId = nextStakeId++;
        uint64 unlocksAt = uint64(block.timestamp + lockSeconds);
        stakes[msg.sender][stakeId] = Stake(uint128(amount), unlocksAt, tierId, fid, false);
        uint256 balanceBefore = token.balanceOf(address(this));
        if (!token.transferFrom(msg.sender, address(this), amount)) revert TransferFailed();
        if (token.balanceOf(address(this)) - balanceBefore != amount) revert TransferFailed();
        emit Staked(msg.sender, stakeId, tierId, amount, unlocksAt, fid);
    }

    function withdraw(uint256 stakeId, uint256 fid) external nonReentrant {
        Stake storage userStake = stakes[msg.sender][stakeId];
        if (userStake.amount == 0 || userStake.withdrawn || fid == 0 || fid != userStake.fid) revert StakeNotFound();
        if (block.timestamp < userStake.unlocksAt) revert StillLocked(userStake.unlocksAt);

        uint256 amount = userStake.amount;
        userStake.withdrawn = true;
        if (!token.transfer(msg.sender, amount)) revert TransferFailed();
        emit Withdrawn(msg.sender, stakeId, amount, fid);
    }
}
