// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {CCIPReceiver} from "@chainlink/contracts-ccip/contracts/applications/CCIPReceiver.sol";
import {Client} from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Actions} from "../shared/Actions.sol";

interface IHederaTokenService {
    function associateToken(address account, address token) external returns (int64 responseCode);
}

/// @title DealManager
/// @notice Lives on Hedera. Applies CRE decisions that arrive over CCIP from the CreRelay on Fuji.
///         Only messages from that one relay on that one chain are accepted.
contract DealManager is CCIPReceiver, Ownable {
    IHederaTokenService internal constant HTS = IHederaTokenService(address(0x167));
    int64 internal constant HTS_SUCCESS = 22;

    uint64 public immutable sourceChainSelector;
    /// @notice CreRelay on the source chain.
    address public relay;

    uint256 public pingCount;
    bytes32 public lastMessageId;

    event ReportReceived(bytes32 indexed messageId, uint8 indexed action);
    event Pinged(bytes32 indexed messageId, string note, uint256 sentAt, uint256 receivedAt);
    event RelaySet(address relay);
    event TokenAssociated(address token);

    error UnknownSource(uint64 chainSelector);
    error UnknownSender(address sender);
    error UnknownAction(uint8 action);
    error AssociationFailed(address token, int64 responseCode);
    error ZeroAddress();

    constructor(address router_, uint64 sourceChainSelector_) CCIPReceiver(router_) Ownable(msg.sender) {
        sourceChainSelector = sourceChainSelector_;
    }

    function _ccipReceive(Client.Any2EVMMessage memory message) internal override {
        if (message.sourceChainSelector != sourceChainSelector) {
            revert UnknownSource(message.sourceChainSelector);
        }
        address sender = abi.decode(message.sender, (address));
        if (sender != relay) revert UnknownSender(sender);

        (uint8 action, bytes memory payload) = abi.decode(message.data, (uint8, bytes));
        lastMessageId = message.messageId;
        emit ReportReceived(message.messageId, action);

        if (action == Actions.PING) _ping(message.messageId, payload);
        else revert UnknownAction(action);
    }

    function _ping(bytes32 messageId, bytes memory payload) internal {
        (string memory note, uint256 sentAt) = abi.decode(payload, (string, uint256));
        pingCount++;
        emit Pinged(messageId, note, sentAt, block.timestamp);
    }

    function setRelay(address relay_) external onlyOwner {
        if (relay_ == address(0)) revert ZeroAddress();
        relay = relay_;
        emit RelaySet(relay_);
    }

    /// @notice Hedera accounts, contracts included, must associate an HTS token (such as USDC)
    ///         before they can hold it.
    function associate(address token) external onlyOwner {
        // Emitted first; a failed association reverts and discards it.
        emit TokenAssociated(token);
        int64 code = HTS.associateToken(address(this), token);
        if (code != HTS_SUCCESS) revert AssociationFailed(token, code);
    }
}
