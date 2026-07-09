// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";

import {WaveRegistry} from "../src/WaveRegistry.sol";
import {WaveEscrow}   from "../src/WaveEscrow.sol";
import {MerkleClaim}  from "../src/MerkleClaim.sol";
import {MockERC20}    from "../src/MockERC20.sol";

/**
 * @title Deploy
 * @notice Full deployment script for WaveDrop on Avalanche Fuji (testnet)
 *         or mainnet.
 *
 * Required env vars
 * ─────────────────
 *   DEPLOYER_ADDRESS   – address corresponding to the broadcast key
 *   OPERATOR_ADDRESS   – backend signer that gets OPERATOR_ROLE
 *   DEPLOY_MOCK_USDC   – "true" on Fuji; omit or "false" on mainnet
 *   USDC_ADDRESS       – required when DEPLOY_MOCK_USDC=false (mainnet USDC)
 *
 * Fuji
 * ────
 *   forge script script/Deploy.s.sol \
 *     --rpc-url fuji \
 *     --broadcast \
 *     --verify \
 *     -e DEPLOY_MOCK_USDC=true
 *
 * Mainnet
 * ───────
 *   forge script script/Deploy.s.sol \
 *     --rpc-url avalanche \
 *     --broadcast \
 *     --verify \
 *     -e DEPLOY_MOCK_USDC=false \
 *     -e USDC_ADDRESS=0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6c
 */
contract Deploy is Script {
    function run() external {
        address deployer  = vm.envAddress("DEPLOYER_ADDRESS");
        address operator  = vm.envAddress("OPERATOR_ADDRESS");
        bool    mockUsdc  = vm.envOr("DEPLOY_MOCK_USDC", true);

        address usdcAddress;

        vm.startBroadcast();

        // ------------------------------------------------------------------
        // 1. Token
        // ------------------------------------------------------------------
        if (mockUsdc) {
            MockERC20 mock = new MockERC20("Mock USDC", "USDC", 6);
            usdcAddress = address(mock);
            console.log("MockERC20 (USDC) :", usdcAddress);

            // Mint 10_000 USDC to the deployer so tests are funded immediately
            mock.mint(deployer, 10_000 * 1e6);
        } else {
            usdcAddress = vm.envAddress("USDC_ADDRESS");
            console.log("Using USDC       :", usdcAddress);
        }

        // ------------------------------------------------------------------
        // 2. WaveRegistry
        // ------------------------------------------------------------------
        WaveRegistry registry = new WaveRegistry(deployer);
        console.log("WaveRegistry     :", address(registry));

        // Grant OPERATOR_ROLE to the backend signer
        registry.grantRole(registry.OPERATOR_ROLE(), operator);

        // ------------------------------------------------------------------
        // 3. MerkleClaim
        // ------------------------------------------------------------------
        MerkleClaim merkleClaim = new MerkleClaim(deployer);
        console.log("MerkleClaim      :", address(merkleClaim));

        merkleClaim.grantRole(merkleClaim.OPERATOR_ROLE(), operator);

        // ------------------------------------------------------------------
        // 4. Example WaveEscrow for Wave #1 (Fuji demo)
        //    In production the backend deploys one per wave via a factory or
        //    direct script invocation. Here we deploy one for smoke-testing.
        // ------------------------------------------------------------------
        if (mockUsdc) {
            // Register a demo ecosystem
            bytes32 ecoTx = keccak256("demo-ecosystem");
            (bool ok, bytes memory ret) = address(registry).call(
                abi.encodeWithSelector(
                    registry.registerEcosystem.selector,
                    "Demo Ecosystem",
                    deployer
                )
            );
            require(ok, "registerEcosystem failed");
            uint256 ecosystemId = abi.decode(ret, (uint256));

            // createWave needs opensAt < closesAt
            uint256 opensAt  = block.timestamp + 60;
            uint256 closesAt = block.timestamp + 60 * 60 * 24 * 7; // +7 days

            // Deploy escrow with a placeholder waveId; we'll update after
            // createWave returns the real one. In practice the backend does this.
            WaveEscrow escrow = new WaveEscrow(bytes32(ecoTx), usdcAddress, operator);
            console.log("WaveEscrow (demo):", address(escrow));

            bytes32 waveId = registry.createWave(
                ecosystemId,
                "Wave #1 — Fuji Demo",
                address(escrow),
                opensAt,
                closesAt
            );
            console.log("Wave #1 ID (hex) :");
            console.logBytes32(waveId);
        }

        vm.stopBroadcast();

        // ------------------------------------------------------------------
        // Summary
        // ------------------------------------------------------------------
        console.log("---");
        console.log("Add to .env:");
        console.log("  REGISTRY_ADDRESS=",    address(registry));
        console.log("  MERKLE_CLAIM_ADDRESS=", address(merkleClaim));
        console.log("  USDC_ADDRESS=",         usdcAddress);
    }
}
