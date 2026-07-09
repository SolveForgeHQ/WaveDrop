// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";

import {WaveRegistry} from "../src/WaveRegistry.sol";
import {WaveEscrow}   from "../src/WaveEscrow.sol";
import {MerkleClaim}  from "../src/MerkleClaim.sol";
import {MockERC20}    from "../src/MockERC20.sol";

/**
 * @title WaveDropTest
 * @notice Full integration test: fund → close → submitRoot → claim →
 *         double-claim (revert) → invalid proof (revert).
 *
 * Merkle tree — 2 leaves, hand-computed
 * ──────────────────────────────────────
 *  leafAlice = keccak256(abi.encodePacked(alice, 600_000))
 *  leafBob   = keccak256(abi.encodePacked(bob,   400_000))
 *  root      = commutativeKeccak256(leafAlice, leafBob)
 *              (OZ sorts the pair internally, so we don't need to pre-sort)
 *
 *  Proof for alice = [leafBob]   (only sibling in a 2-leaf tree)
 *  Proof for bob   = [leafAlice]
 */
contract WaveDropTest is Test {
    // -------------------------------------------------------------------------
    // Actors
    // -------------------------------------------------------------------------

    address internal admin    = makeAddr("admin");
    address internal operator = makeAddr("operator");
    address internal funder   = makeAddr("funder");
    address internal alice    = makeAddr("alice");
    address internal bob      = makeAddr("bob");

    // -------------------------------------------------------------------------
    // Contracts
    // -------------------------------------------------------------------------

    MockERC20    internal usdc;
    WaveRegistry internal registry;
    MerkleClaim  internal merkleClaim;
    WaveEscrow   internal escrow;

    // -------------------------------------------------------------------------
    // Shared wave state
    // -------------------------------------------------------------------------

    bytes32 internal waveId;
    uint256 internal ecosystemId;

    uint256 internal constant ALICE_AMOUNT = 600_000; // $0.60 USDC (6 dec)
    uint256 internal constant BOB_AMOUNT   = 400_000; // $0.40 USDC
    uint256 internal constant TOTAL_POOL   = ALICE_AMOUNT + BOB_AMOUNT;

    bytes32 internal leafAlice;
    bytes32 internal leafBob;
    bytes32 internal merkleRoot;
    bytes32[] internal proofAlice;
    bytes32[] internal proofBob;

    // -------------------------------------------------------------------------
    // setUp — deploy everything, wire roles, build Merkle tree
    // -------------------------------------------------------------------------

    function setUp() public {
        usdc = new MockERC20("Mock USDC", "USDC", 6);

        // Deploy core contracts under admin
        vm.startPrank(admin);
        registry    = new WaveRegistry(admin);
        merkleClaim = new MerkleClaim(admin);
        registry.grantRole(registry.OPERATOR_ROLE(),       operator);
        merkleClaim.grantRole(merkleClaim.OPERATOR_ROLE(), operator);
        vm.stopPrank();

        // Operator: register ecosystem
        vm.prank(operator);
        ecosystemId = registry.registerEcosystem("TestEco", funder);

        // Pre-compute the waveId the registry will assign for waveCounter=2
        // (counter starts at 0; registerEcosystem doesn't touch it;
        //  createWave increments _waveCounter from 1 to 2 for this call
        //  since setUp already registered one ecosystem above via operator
        //  — but _waveCounter is separate from _ecosystemCounter).
        // Simpler approach: predict the escrow's deploy address so we can
        // pass it to createWave in a single call.
        uint256 deployerNonce = vm.getNonce(address(this));
        address predictedEscrow = vm.computeCreateAddress(address(this), deployerNonce);

        // Register the wave — escrow address known ahead of time
        vm.prank(operator);
        waveId = registry.createWave(
            ecosystemId,
            "Wave #1",
            predictedEscrow,
            block.timestamp + 100,
            block.timestamp + 200
        );

        // Deploy escrow — lands at predictedEscrow, constructed with correct waveId
        escrow = new WaveEscrow(waveId, address(usdc), operator);
        assert(address(escrow) == predictedEscrow);

        // Build Merkle tree and fund funder
        _buildTree();
        usdc.mint(funder, TOTAL_POOL);
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    /// @dev OZ commutativeKeccak256 sorts the pair internally, so the proof
    ///      element is just the raw sibling leaf — no manual pre-sort needed.
    ///      Root = commutativeKeccak256(leafAlice, leafBob).
    function _buildTree() internal {
        leafAlice = keccak256(abi.encodePacked(alice, ALICE_AMOUNT));
        leafBob   = keccak256(abi.encodePacked(bob,   BOB_AMOUNT));

        // Replicate commutativeKeccak256 to get the expected root
        (bytes32 lo, bytes32 hi) = leafAlice < leafBob
            ? (leafAlice, leafBob)
            : (leafBob,   leafAlice);
        merkleRoot = keccak256(abi.encodePacked(lo, hi));

        proofAlice = new bytes32[](1);
        proofAlice[0] = leafBob;

        proofBob = new bytes32[](1);
        proofBob[0] = leafAlice;
    }

    /// @dev Runs the complete fund → close → settle pipeline.
    ///      Leaves the system in "claims open" state.
    function _settleWave() internal {
        vm.prank(operator);
        registry.openWave(waveId);

        vm.startPrank(funder);
        usdc.approve(address(escrow), TOTAL_POOL);
        escrow.fund(TOTAL_POOL);
        vm.stopPrank();

        vm.startPrank(operator);
        escrow.close();
        registry.closeWave(waveId);
        escrow.approveForSettlement(address(merkleClaim), TOTAL_POOL);
        merkleClaim.submitRoot(waveId, merkleRoot, address(escrow), address(usdc), TOTAL_POOL);
        registry.markSettled(waveId);
        vm.stopPrank();
    }

    // =========================================================================
    // SECTION 1 — WaveRegistry
    // =========================================================================

    function test_registry_registerEcosystem() public {
        vm.prank(operator);
        uint256 id = registry.registerEcosystem("Foo", address(0x1234));
        WaveRegistry.Ecosystem memory eco = registry.getEcosystem(id);
        assertEq(eco.name,     "Foo");
        assertEq(eco.treasury, address(0x1234));
        assertTrue(eco.active);
    }

    function test_registry_registerEcosystem_revertsIfNotOperator() public {
        vm.prank(alice);
        vm.expectRevert();
        registry.registerEcosystem("Foo", address(0x1234));
    }

    function test_registry_createWave_emitsEvent() public {
        vm.prank(operator);
        uint256 id = registry.registerEcosystem("Eco2", funder);
        WaveEscrow esc2 = new WaveEscrow(bytes32(uint256(1)), address(usdc), operator);

        vm.expectEmit(false, true, false, false);
        emit WaveRegistry.WaveCreated(bytes32(0), id, address(esc2));

        vm.prank(operator);
        registry.createWave(id, "Wave #2", address(esc2), block.timestamp + 1, block.timestamp + 2);
    }

    function test_registry_waveLifecycle_openThenClose() public {
        vm.startPrank(operator);
        registry.openWave(waveId);
        assertEq(uint8(registry.getWave(waveId).status), uint8(WaveRegistry.WaveStatus.OPEN));

        registry.closeWave(waveId);
        assertEq(uint8(registry.getWave(waveId).status), uint8(WaveRegistry.WaveStatus.CLOSED));
        vm.stopPrank();
    }

    function test_registry_closeBeforeOpen_reverts() public {
        vm.prank(operator);
        vm.expectRevert();
        registry.closeWave(waveId); // still PENDING
    }

    function test_registry_invalidTimeRange_reverts() public {
        WaveEscrow esc2 = new WaveEscrow(bytes32(uint256(1)), address(usdc), operator);
        vm.prank(operator);
        vm.expectRevert();
        registry.createWave(ecosystemId, "bad", address(esc2), 100, 100); // opensAt == closesAt
    }

    function test_registry_waveCount() public view {
        // setUp created exactly 1 wave
        assertEq(registry.waveCount(), 1);
    }

    // =========================================================================
    // SECTION 2 — WaveEscrow
    // =========================================================================

    function test_escrow_fund_updatesState() public {
        vm.startPrank(funder);
        usdc.approve(address(escrow), TOTAL_POOL);
        escrow.fund(TOTAL_POOL);
        vm.stopPrank();

        assertEq(escrow.totalDeposited(), TOTAL_POOL);
        assertEq(escrow.deposits(funder), TOTAL_POOL);
        assertEq(usdc.balanceOf(address(escrow)), TOTAL_POOL);
    }

    function test_escrow_fund_emitsWaveFunded() public {
        vm.startPrank(funder);
        usdc.approve(address(escrow), TOTAL_POOL);

        vm.expectEmit(true, true, false, true);
        emit WaveEscrow.WaveFunded(waveId, funder, TOTAL_POOL, TOTAL_POOL);
        escrow.fund(TOTAL_POOL);
        vm.stopPrank();
    }

    function test_escrow_fund_afterClose_reverts() public {
        vm.prank(operator);
        escrow.close();

        vm.startPrank(funder);
        usdc.approve(address(escrow), TOTAL_POOL);
        vm.expectRevert(WaveEscrow.EscrowNotOpen.selector);
        escrow.fund(TOTAL_POOL);
        vm.stopPrank();
    }

    function test_escrow_fund_zeroAmount_reverts() public {
        vm.prank(funder);
        vm.expectRevert(WaveEscrow.ZeroAmount.selector);
        escrow.fund(0);
    }

    function test_escrow_multipleFunders() public {
        address funder2 = makeAddr("funder2");
        usdc.mint(funder2, 500_000);

        vm.startPrank(funder);
        usdc.approve(address(escrow), TOTAL_POOL);
        escrow.fund(TOTAL_POOL);
        vm.stopPrank();

        vm.startPrank(funder2);
        usdc.approve(address(escrow), 500_000);
        escrow.fund(500_000);
        vm.stopPrank();

        assertEq(escrow.totalDeposited(), TOTAL_POOL + 500_000);
        assertEq(escrow.deposits(funder2), 500_000);
    }

    function test_escrow_close_emitsEvent() public {
        vm.expectEmit(true, false, false, true);
        emit WaveEscrow.WaveClosed(waveId, 0);
        vm.prank(operator);
        escrow.close();
        assertEq(uint8(escrow.status()), uint8(WaveEscrow.Status.CLOSED));
    }

    function test_escrow_close_revertsIfNotOperator() public {
        vm.prank(alice);
        vm.expectRevert(WaveEscrow.NotOperator.selector);
        escrow.close();
    }

    function test_escrow_approveForSettlement_revertsIfNotClosed() public {
        vm.prank(operator);
        vm.expectRevert(WaveEscrow.EscrowNotClosed.selector);
        escrow.approveForSettlement(address(merkleClaim), TOTAL_POOL);
    }

    function test_escrow_approveForSettlement_setsSettled() public {
        vm.startPrank(operator);
        escrow.close();
        escrow.approveForSettlement(address(merkleClaim), TOTAL_POOL);
        vm.stopPrank();
        assertEq(uint8(escrow.status()), uint8(WaveEscrow.Status.SETTLED));
    }

    function test_escrow_cannotSettleTwice() public {
        vm.startPrank(operator);
        escrow.close();
        escrow.approveForSettlement(address(merkleClaim), TOTAL_POOL);
        vm.expectRevert(WaveEscrow.EscrowNotClosed.selector);
        escrow.approveForSettlement(address(merkleClaim), TOTAL_POOL);
        vm.stopPrank();
    }

    // =========================================================================
    // SECTION 3 — MerkleClaim: happy path
    // =========================================================================

    function test_fullFlow_aliceClaims() public {
        _settleWave();

        vm.prank(alice);
        merkleClaim.claim(waveId, ALICE_AMOUNT, proofAlice);

        assertEq(usdc.balanceOf(alice), ALICE_AMOUNT);
        assertTrue(merkleClaim.isClaimed(waveId, alice));
    }

    function test_fullFlow_bobClaims() public {
        _settleWave();

        vm.prank(bob);
        merkleClaim.claim(waveId, BOB_AMOUNT, proofBob);

        assertEq(usdc.balanceOf(bob), BOB_AMOUNT);
        assertTrue(merkleClaim.isClaimed(waveId, bob));
    }

    function test_fullFlow_bothClaim_unclaimedReachesZero() public {
        _settleWave();

        vm.prank(alice);
        merkleClaim.claim(waveId, ALICE_AMOUNT, proofAlice);

        vm.prank(bob);
        merkleClaim.claim(waveId, BOB_AMOUNT, proofBob);

        assertEq(merkleClaim.unclaimedAmount(waveId), 0);
        assertEq(usdc.balanceOf(address(merkleClaim)), 0);
    }

    function test_claim_emitsClaimed() public {
        _settleWave();

        vm.expectEmit(true, true, false, true);
        emit MerkleClaim.Claimed(waveId, alice, ALICE_AMOUNT);

        vm.prank(alice);
        merkleClaim.claim(waveId, ALICE_AMOUNT, proofAlice);
    }

    function test_submitRoot_emitsRootSubmitted() public {
        vm.prank(operator);
        registry.openWave(waveId);

        vm.startPrank(funder);
        usdc.approve(address(escrow), TOTAL_POOL);
        escrow.fund(TOTAL_POOL);
        vm.stopPrank();

        vm.startPrank(operator);
        escrow.close();
        registry.closeWave(waveId);
        escrow.approveForSettlement(address(merkleClaim), TOTAL_POOL);

        vm.expectEmit(true, false, false, true);
        emit MerkleClaim.RootSubmitted(waveId, merkleRoot, address(usdc), TOTAL_POOL);
        merkleClaim.submitRoot(waveId, merkleRoot, address(escrow), address(usdc), TOTAL_POOL);
        vm.stopPrank();
    }

    // =========================================================================
    // SECTION 4 — MerkleClaim: revert cases
    // =========================================================================

    function test_doubleClaim_reverts() public {
        _settleWave();

        vm.startPrank(alice);
        merkleClaim.claim(waveId, ALICE_AMOUNT, proofAlice);

        vm.expectRevert(
            abi.encodeWithSelector(MerkleClaim.AlreadyClaimed.selector, waveId, alice)
        );
        merkleClaim.claim(waveId, ALICE_AMOUNT, proofAlice);
        vm.stopPrank();
    }

    function test_invalidProof_reverts() public {
        _settleWave();

        bytes32[] memory badProof = new bytes32[](1);
        badProof[0] = bytes32(uint256(0xdeadbeef));

        vm.prank(alice);
        vm.expectRevert(MerkleClaim.InvalidProof.selector);
        merkleClaim.claim(waveId, ALICE_AMOUNT, badProof);
    }

    function test_wrongAmount_invalidProof() public {
        _settleWave();

        // Correct proof, wrong amount → leaf mismatch → InvalidProof
        vm.prank(alice);
        vm.expectRevert(MerkleClaim.InvalidProof.selector);
        merkleClaim.claim(waveId, ALICE_AMOUNT + 1, proofAlice);
    }

    function test_claimWrongWave_reverts() public {
        _settleWave();

        bytes32 fakeWaveId = keccak256("nonexistent");

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(MerkleClaim.WaveNotActive.selector, fakeWaveId)
        );
        merkleClaim.claim(fakeWaveId, ALICE_AMOUNT, proofAlice);
    }

    function test_claimBeforeRootSubmitted_reverts() public {
        // Wave not settled yet — root never submitted
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(MerkleClaim.WaveNotActive.selector, waveId)
        );
        merkleClaim.claim(waveId, ALICE_AMOUNT, proofAlice);
    }

    function test_submitRoot_alreadyActive_reverts() public {
        _settleWave();

        vm.prank(operator);
        vm.expectRevert(
            abi.encodeWithSelector(MerkleClaim.WaveAlreadyActive.selector, waveId)
        );
        merkleClaim.submitRoot(waveId, merkleRoot, address(escrow), address(usdc), TOTAL_POOL);
    }

    function test_submitRoot_revertsIfNotOperator() public {
        vm.prank(alice);
        vm.expectRevert();
        merkleClaim.submitRoot(waveId, merkleRoot, address(escrow), address(usdc), TOTAL_POOL);
    }

    function test_bobCannotUseAlicesProof() public {
        _settleWave();

        // Bob tries to claim Alice's amount using Alice's proof — leaf won't match
        vm.prank(bob);
        vm.expectRevert(MerkleClaim.InvalidProof.selector);
        merkleClaim.claim(waveId, ALICE_AMOUNT, proofAlice);
    }

    // =========================================================================
    // SECTION 5 — Multi-wave isolation
    // =========================================================================

    function test_crossWave_rootsAreIsolated() public {
        _settleWave();

        // Deploy a second independent wave
        vm.prank(operator);
        uint256 ecoId2 = registry.registerEcosystem("Eco2", funder);

        WaveEscrow escrow2 = new WaveEscrow(bytes32(uint256(99)), address(usdc), operator);

        vm.prank(operator);
        bytes32 waveId2 = registry.createWave(
            ecoId2, "Wave #2", address(escrow2),
            block.timestamp + 1, block.timestamp + 2
        );

        // Wave 2 root not yet submitted — claim must revert
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(MerkleClaim.WaveNotActive.selector, waveId2)
        );
        merkleClaim.claim(waveId2, ALICE_AMOUNT, proofAlice);
    }

    function test_twoWaves_independentClaims() public {
        _settleWave(); // wave 1 settled

        // Build wave 2 with a different allocation
        address carol = makeAddr("carol");
        uint256 carolAmount = 1_000_000; // $1.00

        bytes32 leafCarol = keccak256(abi.encodePacked(carol, carolAmount));
        // Single-leaf tree: root == leaf (proof is empty)
        bytes32 root2 = leafCarol;

        vm.prank(operator);
        uint256 ecoId2 = registry.registerEcosystem("Eco2", funder);

        WaveEscrow escrow2 = new WaveEscrow(bytes32(uint256(2)), address(usdc), operator);
        usdc.mint(funder, carolAmount);

        vm.prank(operator);
        bytes32 waveId2 = registry.createWave(
            ecoId2, "Wave #2", address(escrow2),
            block.timestamp + 1, block.timestamp + 2
        );

        vm.prank(operator);
        registry.openWave(waveId2);

        vm.startPrank(funder);
        usdc.approve(address(escrow2), carolAmount);
        escrow2.fund(carolAmount);
        vm.stopPrank();

        vm.startPrank(operator);
        escrow2.close();
        registry.closeWave(waveId2);
        escrow2.approveForSettlement(address(merkleClaim), carolAmount);
        merkleClaim.submitRoot(waveId2, root2, address(escrow2), address(usdc), carolAmount);
        registry.markSettled(waveId2);
        vm.stopPrank();

        // Carol claims wave 2
        bytes32[] memory emptyProof = new bytes32[](0);
        vm.prank(carol);
        merkleClaim.claim(waveId2, carolAmount, emptyProof);
        assertEq(usdc.balanceOf(carol), carolAmount);

        // Alice's wave 1 claim still works independently
        vm.prank(alice);
        merkleClaim.claim(waveId, ALICE_AMOUNT, proofAlice);
        assertEq(usdc.balanceOf(alice), ALICE_AMOUNT);
    }
}
