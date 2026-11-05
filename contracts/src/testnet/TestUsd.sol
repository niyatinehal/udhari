// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title TestUsd
/// @notice Testnet stand-in for USDC (6 decimals, open faucet) for when Circle's Hedera testnet
///         faucet is not delivering. Never deploy outside a testnet.
contract TestUsd is ERC20 {
    uint256 public constant FAUCET_AMOUNT = 1_000e6;

    constructor() ERC20("Test USD", "tUSD") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Mints 1,000 tUSD to the caller.
    function faucet() external {
        _mint(msg.sender, FAUCET_AMOUNT);
    }

    /// @notice Mints 1,000 tUSD to `to`, e.g. a wallet that has no HBAR for gas yet.
    function faucetTo(address to) external {
        _mint(to, FAUCET_AMOUNT);
    }
}
