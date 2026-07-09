// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title WaveRegistry
 * @notice Central registry that tracks wave metadata and the addresses of
 *         their corresponding WaveEscrow contracts.
 *
 * Roles
 * ─────
 *  DEFAULT_ADMIN_ROLE  – protocol deployer; can grant/revoke all roles.
 *  OPERATOR_ROLE       – backend signer; can register ecosystems, create
 *                        waves, and close them once contributions are tallied.
 *
 * Off-chain flow
 * ──────────────
 *  1. Admin registers an Ecosystem partner (registerEcosystem).
 *  2. Operator creates a Wave; a WaveEscrow is deployed at the same time
 *     by the WaveEscrow factory call (done from the deploy script / backend).
 *     The escrow address is passed into createWave so the registry can track it.
 *  3. Operator calls closeWave once the contribution window ends.
 *  4. Operator calls submitMerkleRoot (on MerkleClaim) after settlement.
 *     The registry itself does not store the root – MerkleClaim does.
 */
contract WaveRegistry is AccessControl {
    // -------------------------------------------------------------------------
    // Roles
    // -------------------------------------------------------------------------

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------

    enum WaveStatus {
        PENDING, // created but not yet open for funding
        OPEN, // ecosystem partners can deposit
        CLOSED, // contribution window ended; awaiting Merkle root submission
        SETTLED // Merkle root submitted; claims live
    }

    struct Ecosystem {
        string name;
        address treasury; // multisig or EOA that funds Waves
        bool active;
        uint256 createdAt;
    }

    struct Wave {
        bytes32 id;
        uint256 ecosystemId;
        string name;
        address escrow; // WaveEscrow deployed for this wave
        WaveStatus status;
        uint256 opensAt;
        uint256 closesAt;
        uint256 createdAt;
    }

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    uint256 private _ecosystemCounter;
    uint256 private _waveCounter;

    mapping(uint256 => Ecosystem) public ecosystems;
    mapping(bytes32 => Wave) public waves;
    /// @notice Ordered list of wave IDs so callers can enumerate them.
    bytes32[] public waveIds;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event EcosystemRegistered(uint256 indexed id, string name, address treasury);
    event WaveCreated(bytes32 indexed waveId, uint256 indexed ecosystemId, address escrow);
    event WaveOpened(bytes32 indexed waveId);
    event WaveClosed(bytes32 indexed waveId);
    event WaveSettled(bytes32 indexed waveId);

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error EcosystemNotFound(uint256 id);
    error EcosystemInactive(uint256 id);
    error WaveNotFound(bytes32 waveId);
    error InvalidStatus(WaveStatus current, WaveStatus expected);
    error InvalidTimeRange(uint256 opensAt, uint256 closesAt);
    error InvalidAddress();

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(address admin) {
        if (admin == address(0)) revert InvalidAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    // -------------------------------------------------------------------------
    // Ecosystem management
    // -------------------------------------------------------------------------

    /**
     * @notice Register a new ecosystem partner.
     * @param name     Human-readable project name.
     * @param treasury Address authorised to fund waves for this ecosystem.
     */
    function registerEcosystem(string calldata name, address treasury)
        external
        onlyRole(OPERATOR_ROLE)
        returns (uint256 id)
    {
        if (treasury == address(0)) revert InvalidAddress();

        id = ++_ecosystemCounter;
        ecosystems[id] =
            Ecosystem({name: name, treasury: treasury, active: true, createdAt: block.timestamp});

        emit EcosystemRegistered(id, name, treasury);
    }

    /**
     * @notice Toggle an ecosystem's active flag.
     */
    function setEcosystemActive(uint256 id, bool active) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (ecosystems[id].createdAt == 0) revert EcosystemNotFound(id);
        ecosystems[id].active = active;
    }

    // -------------------------------------------------------------------------
    // Wave lifecycle
    // -------------------------------------------------------------------------

    /**
     * @notice Register a new Wave. The WaveEscrow must be deployed beforehand
     *         (by the deploy script or backend) and its address passed here.
     * @param ecosystemId  ID returned by registerEcosystem.
     * @param name         Human-readable wave name, e.g. "Wave #3 – Q3 2025".
     * @param escrow       Address of the WaveEscrow contract for this wave.
     * @param opensAt      Unix timestamp when funding opens.
     * @param closesAt     Unix timestamp when contributions stop.
     */
    function createWave(
        uint256 ecosystemId,
        string calldata name,
        address escrow,
        uint256 opensAt,
        uint256 closesAt
    ) external onlyRole(OPERATOR_ROLE) returns (bytes32 waveId) {
        if (ecosystems[ecosystemId].createdAt == 0) {
            revert EcosystemNotFound(ecosystemId);
        }
        if (!ecosystems[ecosystemId].active) revert EcosystemInactive(ecosystemId);
        if (escrow == address(0)) revert InvalidAddress();
        if (opensAt >= closesAt) revert InvalidTimeRange(opensAt, closesAt);

        waveId = keccak256(abi.encodePacked(++_waveCounter, ecosystemId, block.timestamp));

        waves[waveId] = Wave({
            id: waveId,
            ecosystemId: ecosystemId,
            name: name,
            escrow: escrow,
            status: WaveStatus.PENDING,
            opensAt: opensAt,
            closesAt: closesAt,
            createdAt: block.timestamp
        });

        waveIds.push(waveId);

        emit WaveCreated(waveId, ecosystemId, escrow);
    }

    /**
     * @notice Transition a Wave from PENDING → OPEN.
     *         Called by the operator once funding should begin.
     */
    function openWave(bytes32 waveId) external onlyRole(OPERATOR_ROLE) {
        Wave storage w = _getWave(waveId);
        if (w.status != WaveStatus.PENDING) revert InvalidStatus(w.status, WaveStatus.PENDING);
        w.status = WaveStatus.OPEN;
        emit WaveOpened(waveId);
    }

    /**
     * @notice Transition a Wave from OPEN → CLOSED.
     *         Called by the operator once the contribution window ends.
     */
    function closeWave(bytes32 waveId) external onlyRole(OPERATOR_ROLE) {
        Wave storage w = _getWave(waveId);
        if (w.status != WaveStatus.OPEN) revert InvalidStatus(w.status, WaveStatus.OPEN);
        w.status = WaveStatus.CLOSED;
        emit WaveClosed(waveId);
    }

    /**
     * @notice Transition a Wave from CLOSED → SETTLED.
     *         Called by MerkleClaim after a valid root is submitted.
     *         MerkleClaim must hold OPERATOR_ROLE or this is called internally
     *         by the operator after submitMerkleRoot succeeds.
     */
    function markSettled(bytes32 waveId) external onlyRole(OPERATOR_ROLE) {
        Wave storage w = _getWave(waveId);
        if (w.status != WaveStatus.CLOSED) revert InvalidStatus(w.status, WaveStatus.CLOSED);
        w.status = WaveStatus.SETTLED;
        emit WaveSettled(waveId);
    }

    // -------------------------------------------------------------------------
    // Views
    // -------------------------------------------------------------------------

    function getWave(bytes32 waveId) external view returns (Wave memory) {
        return _getWave(waveId);
    }

    function getEcosystem(uint256 id) external view returns (Ecosystem memory) {
        if (ecosystems[id].createdAt == 0) revert EcosystemNotFound(id);
        return ecosystems[id];
    }

    function waveCount() external view returns (uint256) {
        return waveIds.length;
    }

    // -------------------------------------------------------------------------
    // Internal
    // -------------------------------------------------------------------------

    function _getWave(bytes32 waveId) internal view returns (Wave storage w) {
        w = waves[waveId];
        if (w.createdAt == 0) revert WaveNotFound(waveId);
    }
}
