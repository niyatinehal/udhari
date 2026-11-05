// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @notice Report actions shared by the CRE workflows, the Fuji relay and the Hedera deal manager.
///         A report is always `abi.encode(uint8 action, bytes payload)`.
library Actions {
    uint8 internal constant PING = 0;
    uint8 internal constant APPROVE_DEAL = 1;
    uint8 internal constant VERIFY_INVESTOR = 2;
    uint8 internal constant CONFIRM_REPAYMENT = 3;
    uint8 internal constant MARK_LATE = 4;
    uint8 internal constant RECONCILE = 5;
}
