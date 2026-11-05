// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IReceiver} from "@chainlink/contracts/src/v0.8/keystone/interfaces/IReceiver.sol";
import {IRouterClient} from "@chainlink/contracts-ccip/contracts/interfaces/IRouterClient.sol";
import {Client} from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";
import {ExtraArgsCodec} from "@chainlink/contracts-ccip/contracts/libraries/ExtraArgsCodec.sol";
import {IERC165} from "@openzeppelin/contracts@5.0.2/utils/introspection/IERC165.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title CreRelay
/// @notice Lives on Avalanche Fuji, a chain CRE can write to. Takes each signed CRE report from the
///         Chainlink forwarder and sends it unchanged over CCIP to the DealManager on Hedera, which
///         CRE cannot reach directly. CCIP fees are paid in LINK held by this contract.
contract CreRelay is IReceiver, Ownable {
    using SafeERC20 for IERC20;

    IRouterClient public immutable router;
    IERC20 public immutable link;
    uint64 public immutable destChainSelector;
    /// @notice The only caller allowed to deliver reports: the CRE forwarder for this chain.
    address public immutable forwarder;

    /// @notice DealManager on Hedera.
    address public destReceiver;
    /// @notice Gas for DealManager.ccipReceive on Hedera.
    uint32 public destGasLimit = 500_000;

    event ReportRelayed(bytes32 indexed messageId, uint8 indexed action, uint256 fee);
    event DestReceiverSet(address receiver);
    event DestGasLimitSet(uint32 gasLimit);

    error NotForwarder(address caller);
    error NoDestReceiver();
    error ZeroAddress();

    constructor(address router_, address link_, uint64 destChainSelector_, address forwarder_)
        Ownable(msg.sender)
    {
        if (router_ == address(0) || link_ == address(0) || forwarder_ == address(0)) revert ZeroAddress();
        router = IRouterClient(router_);
        link = IERC20(link_);
        destChainSelector = destChainSelector_;
        forwarder = forwarder_;
    }

    /// @inheritdoc IReceiver
    function onReport(bytes calldata, bytes calldata report) external override {
        if (msg.sender != forwarder) revert NotForwarder(msg.sender);
        if (destReceiver == address(0)) revert NoDestReceiver();

        Client.EVM2AnyMessage memory message = Client.EVM2AnyMessage({
            receiver: abi.encode(destReceiver),
            data: report,
            tokenAmounts: new Client.EVMTokenAmount[](0),
            feeToken: address(link),
            // Zero finality config: CCIP waits for Fuji finality, which is under a second.
            extraArgs: ExtraArgsCodec._getBasicEncodedExtraArgsV3(destGasLimit, bytes4(0))
        });

        uint256 fee = router.getFee(destChainSelector, message);
        link.forceApprove(address(router), fee);
        bytes32 messageId = router.ccipSend(destChainSelector, message);

        (uint8 action,) = abi.decode(report, (uint8, bytes));
        // The message id only exists once the router has accepted the message.
        // forge-lint: disable-next-line(reentrancy-events)
        emit ReportRelayed(messageId, action, fee);
    }

    function supportsInterface(bytes4 interfaceId) public pure override returns (bool) {
        return interfaceId == type(IReceiver).interfaceId || interfaceId == type(IERC165).interfaceId;
    }

    function setDestReceiver(address receiver) external onlyOwner {
        if (receiver == address(0)) revert ZeroAddress();
        destReceiver = receiver;
        emit DestReceiverSet(receiver);
    }

    function setDestGasLimit(uint32 gasLimit) external onlyOwner {
        destGasLimit = gasLimit;
        emit DestGasLimitSet(gasLimit);
    }

    /// @notice Recover LINK or any other token sent here.
    function withdraw(address token, address to, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(to, amount);
    }
}
