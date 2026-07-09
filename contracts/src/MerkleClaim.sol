// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20}        from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20}     from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {MerkleProof}   from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/**
 * @title MerkleClaim
 * @notice Multi-wave Merkle-drop distributor. A single deployment handles all
 *         WaveDrop waves — no redeployment needed for each cycle.
 *
 * Flow
 * ────
 *  1. Operator calls submitRoot(waveId, merkleRoot, escrow, totalAmount).
 *       - Pulls `totalAmount` USDC from WaveEscrow (requires prior approval).
 *       - Stores the root for `waveId`.
 *  2. Contributors call claim(waveId, amount, proof).
 *       - Verifies the Merkle proof against the stored root.
 *       - Marks the (waveId, msg.sender) pair as claimed (double-claim guard).
 *       - Transfers USDC to msg.sender.
 *
 * Leaf encoding
 * ─────────────
 *   leaf = keccak256(abi.encodePacked(claimant, amount))
 *
 *   This matches the encoding used by the backend Merkle tree builder
 *   (see shared/src/utils/merkle.ts).
 *
 * Double-claim protection
 * ───────────────────────
 *   Uses a per-wave mapping(address => bool) rather than a bitmap because
 *   contributor addresses are sparse and known only at settlement time. A
 *   bitmap would require knowing the index of each leaf up-front; the address
 *   mapping is simpler and costs one extra SLOAD per claim (~2100 gas) vs
 *   ~5000 gas for a fresh bitmap slot — acceptable trade-off.
 */
contract MerkleClaim is AccessControl {
    using SafeERC20 for IERC20;

    // -------------------------------------------------------------------------
    // Roles
    // -------------------------------------------------------------------------

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------

    struct WaveClaimData {
        bytes32 merkleRoot;
        address token;
        uint256 totalAmount;
        uint256 claimedAmount;
        bool    active;
    }

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    /// @notice waveId => claim data
    mapping(bytes32 => WaveClaimData) public waveClaims;

    /// @notice waveId => claimant => has claimed
    mapping(bytes32 => mapping(address => bool)) public hasClaimed;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event RootSubmitted(
        bytes32 indexed waveId,
        bytes32         merkleRoot,
        address         token,
        uint256         totalAmount
    );

    event Claimed(
        bytes32 indexed waveId,
        address indexed claimant,
        uint256         amount
    );

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error WaveAlreadyActive(bytes32 waveId);
    error WaveNotActive(bytes32 waveId);
    error AlreadyClaimed(bytes32 waveId, address claimant);
    error InvalidProof();
    error ZeroAmount();
    error InvalidAddress();

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(address admin) {
        if (admin == address(0)) revert InvalidAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    // -------------------------------------------------------------------------
    // Operator: submit root
    // -------------------------------------------------------------------------

    /**
     * @notice Submit a Merkle root for a closed wave and pull USDC from escrow.
     *         WaveEscrow.approveForSettlement must be called first so this
     *         contract has allowance to transferFrom the escrow.
     *
     * @param waveId      bytes32 wave identifier.
     * @param merkleRoot  Root of the (address, amount) Merkle tree.
     * @param escrow      WaveEscrow address that holds the USDC pool.
     * @param token       USDC token address (must match what escrow holds).
     * @param totalAmount Total USDC to pull from escrow (in 6-decimal units).
     */
    function submitRoot(
        bytes32 waveId,
        bytes32 merkleRoot,
        address escrow,
        address token,
        uint256 totalAmount
    ) external onlyRole(OPERATOR_ROLE) {
        if (waveClaims[waveId].active)  revert WaveAlreadyActive(waveId);
        if (escrow   == address(0))     revert InvalidAddress();
        if (token    == address(0))     revert InvalidAddress();
        if (totalAmount == 0)           revert ZeroAmount();

        waveClaims[waveId] = WaveClaimData({
            merkleRoot:    merkleRoot,
            token:         token,
            totalAmount:   totalAmount,
            claimedAmount: 0,
            active:        true
        });

        // Pull the full pool from escrow into this contract.
        IERC20(token).safeTransferFrom(escrow, address(this), totalAmount);

        emit RootSubmitted(waveId, merkleRoot, token, totalAmount);
    }

    // -------------------------------------------------------------------------
    // Contributors: claim
    // -------------------------------------------------------------------------

    /**
     * @notice Claim a USDC payout for a settled Wave.
     * @param waveId  bytes32 wave identifier.
     * @param amount  USDC amount (6-decimal units) allocated to msg.sender.
     * @param proof   Merkle proof for leaf = keccak256(abi.encodePacked(msg.sender, amount)).
     */
    function claim(
        bytes32          waveId,
        uint256          amount,
        bytes32[] calldata proof
    ) external {
        WaveClaimData storage data = waveClaims[waveId];
        if (!data.active)                         revert WaveNotActive(waveId);
        if (hasClaimed[waveId][msg.sender])        revert AlreadyClaimed(waveId, msg.sender);
        if (amount == 0)                           revert ZeroAmount();

        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, amount));
        if (!MerkleProof.verify(proof, data.merkleRoot, leaf)) revert InvalidProof();

        hasClaimed[waveId][msg.sender] = true;
        data.claimedAmount += amount;

        IERC20(data.token).safeTransfer(msg.sender, amount);

        emit Claimed(waveId, msg.sender, amount);
    }

    // -------------------------------------------------------------------------
    // Views
    // -------------------------------------------------------------------------

    /**
     * @notice Returns true if msg.sender (or any address) has already claimed
     *         for this wave.
     */
    function isClaimed(bytes32 waveId, address claimant) external view returns (bool) {
        return hasClaimed[waveId][claimant];
    }

    /**
     * @notice Remaining unclaimed USDC in a wave pool.
     */
    function unclaimedAmount(bytes32 waveId) external view returns (uint256) {
        WaveClaimData storage data = waveClaims[waveId];
        if (!data.active) return 0;
        return data.totalAmount - data.claimedAmount;
    }
}
