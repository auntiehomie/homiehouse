// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title HomiefyPFP
 * @notice A capped collection of user-created Homiehouse profile portraits.
 *         Each wallet gets one free mint; later mints cost exactly 0.0005 ETH.
 *         Deploy on Base to match the Homiehouse wallet experience.
 */
contract HomiefyPFP is ERC721URIStorage, Ownable, ReentrancyGuard {
    uint256 public constant MAX_SUPPLY = 10_000;
    uint256 public constant MINT_PRICE = 0.0005 ether;

    uint256 public totalMinted;
    address payable public treasury;
    mapping(address => bool) public freeMintClaimed;

    event PfpMinted(address indexed recipient, uint256 indexed tokenId, bool freeMint, string tokenURI);
    event TreasuryUpdated(address indexed previousTreasury, address indexed newTreasury);

    error SoldOut();
    error IncorrectPayment();
    error InvalidTreasury();
    error InvalidMetadataURI();
    error TreasuryPaymentFailed();

    constructor(address payable treasury_)
        ERC721("Homiefy by Homiehouse", "HOMIEFY")
        Ownable(msg.sender)
    {
        if (treasury_ == address(0)) revert InvalidTreasury();
        treasury = treasury_;
    }

    function mint(string calldata metadataURI) external payable nonReentrant returns (uint256 tokenId) {
        if (totalMinted >= MAX_SUPPLY) revert SoldOut();
        bytes memory uriBytes = bytes(metadataURI);
        if (uriBytes.length < 7 || uriBytes.length > 512) revert InvalidMetadataURI();
        if (
            uriBytes[0] != bytes1("i") || uriBytes[1] != bytes1("p") ||
            uriBytes[2] != bytes1("f") || uriBytes[3] != bytes1("s") ||
            uriBytes[4] != bytes1(":") || uriBytes[5] != bytes1("/")
        ) revert InvalidMetadataURI();

        bool isFree = !freeMintClaimed[msg.sender];
        if (isFree) {
            if (msg.value != 0) revert IncorrectPayment();
            freeMintClaimed[msg.sender] = true;
        } else if (msg.value != MINT_PRICE) {
            revert IncorrectPayment();
        }

        tokenId = ++totalMinted;
        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, metadataURI);

        if (!isFree) {
            (bool sent, ) = treasury.call{value: msg.value}("");
            if (!sent) revert TreasuryPaymentFailed();
        }

        emit PfpMinted(msg.sender, tokenId, isFree, metadataURI);
    }

    function setTreasury(address payable newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert InvalidTreasury();
        address previous = treasury;
        treasury = newTreasury;
        emit TreasuryUpdated(previous, newTreasury);
    }
}
