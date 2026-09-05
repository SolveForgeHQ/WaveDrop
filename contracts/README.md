# WaveDrop Smart Contracts (Stellar / Soroban)

WaveDrop is migrating its settlement layer from EVM (Avalanche) to the **Stellar network** using **Soroban** smart contracts.

This directory is currently being scaffolded for the new Rust-based Soroban contracts.

## Overview

The WaveDrop smart contract is responsible for:
1. Holding USDC bounties in escrow during an active Wave.
2. Verifying Merkle proofs submitted by contributors to claim their payouts.
3. Disbursing USDC on the Stellar network.

## Prerequisites

To build and test Soroban contracts, you need the Rust toolchain and the Stellar CLI:

1. **Install Rust**:
   `ash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   `
2. **Add WASM target**:
   `ash
   rustup target add wasm32-unknown-unknown
   `
3. **Install Stellar CLI**:
   `ash
   cargo install --locked stellar-cli
   `

## Development Workflow

### Build
`ash
cargo build --target wasm32-unknown-unknown --release
`

### Test
`ash
cargo test
`

### Deploy to Testnet
`ash
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/wavedrop_contract.wasm \
  --source <your-secret-key> \
  --network testnet
`

*Note: The actual Soroban contract implementation is pending in an upcoming bounty.*
