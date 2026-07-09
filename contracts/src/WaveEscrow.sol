// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title WaveEscrow
 * @notice Holds USDC for a single Wave.
 *
 * Lifecycle
 * ─────────
 *  OPEN    → ecosystem partners call fund(); multiple funders are supported.
 *  CLOSED  → operator calls close(); no further deposits accepted.
 *  SETTLED → operator calls approve(MerkleClaim, totalAmount) so that
 *            MerkleClaim.sol can pull the full pool via transferFrom.
 *
 * One WaveEscrow is deployed per Wave. The deployer passes in:
 *   - waveId     : the bytes32 identifier registered in WaveRegistry
 *   - token      : USDC contract address
 *   - operator   : backend signer address (only address that can close / approve)
 *
 * Security note: the operator is a trusted backend EOA. For production you
 * would want to make this a multisig (e.g. Gnosis Safe).
 */
contract WaveEscrow {
    using SafeERC20 for IERC20;

    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------

    enum Status {
        OPEN,
        CLOSED,
        SETTLED
    }

    // -------------------------------------------------------------------------
    // Immutables
    // -------------------------------------------------------------------------

    bytes32 public immutable waveId;
    IERC20 public immutable token;
    address public immutable operator;

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    Status public status;
    uint256 public totalDeposited;
    mapping(address => uint256) public deposits;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event WaveFunded(bytes32 indexed waveId, address indexed funder, uint256 amount, uint256 newTotal);

    event WaveClosed(bytes32 indexed waveId, uint256 totalDeposited);

    event RootSubmitted(bytes32 indexed waveId, address indexed merkleClaim, uint256 amount);

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error NotOperator();
    error EscrowNotOpen();
    error EscrowNotClosed();
    error EscrowAlreadySettled();
    error ZeroAmount();
    error InvalidAddress();

    // -------------------------------------------------------------------------
    // Modifiers
    // -------------------------------------------------------------------------

    modifier onlyOperator() {
        if (msg.sender != operator) revert NotOperator();
        _;
    }

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /**
     * @param _waveId    bytes32 wave identifier (from WaveRegistry.createWave).
     * @param _token     USDC (or MockERC20 on Fuji) contract address.
     * @param _operator  Backend signer that controls close/settle.
     */
    constructor(bytes32 _waveId, address _token, address _operator) {
        if (_token == address(0)) revert InvalidAddress();
        if (_operator == address(0)) revert InvalidAddress();

        waveId = _waveId;
        token = IERC20(_token);
        operator = _operator;
        status = Status.OPEN;
    }

    // -------------------------------------------------------------------------
    // Funding
    // -------------------------------------------------------------------------

    /**
     * @notice Deposit USDC into the escrow.
     *         Caller must have approved this contract for at least `amount`.
     * @param amount  Token amount in smallest unit (6 decimals for USDC).
     */
    function fund(uint256 amount) external {
        if (status != Status.OPEN) revert EscrowNotOpen();
        if (amount == 0) revert ZeroAmount();

        deposits[msg.sender] += amount;
        totalDeposited += amount;

        token.safeTransferFrom(msg.sender, address(this), amount);

        emit WaveFunded(waveId, msg.sender, amount, totalDeposited);
    }

    // -------------------------------------------------------------------------
    // Operator actions
    // -------------------------------------------------------------------------

    /**
     * @notice Close the escrow; no further deposits accepted.
     *         Typically called by the operator when the contribution window ends.
     */
    function close() external onlyOperator {
        if (status != Status.OPEN) revert EscrowNotOpen();
        status = Status.CLOSED;
        emit WaveClosed(waveId, totalDeposited);
    }

    /**
     * @notice Approve MerkleClaim to pull the full pool so it can distribute USDC.
     *         Marks the escrow as SETTLED; callable only once per wave.
     * @param merkleClaim  Address of the MerkleClaim contract.
     * @param amount       Must equal totalDeposited (sanity check).
     */
    function approveForSettlement(address merkleClaim, uint256 amount) external onlyOperator {
        if (status != Status.CLOSED) revert EscrowNotClosed();
        if (merkleClaim == address(0)) revert InvalidAddress();
        if (amount == 0) revert ZeroAmount();

        status = Status.SETTLED;

        // Grant MerkleClaim a precise allowance — no open-ended approvals.
        token.safeIncreaseAllowance(merkleClaim, amount);

        emit RootSubmitted(waveId, merkleClaim, amount);
    }
}
