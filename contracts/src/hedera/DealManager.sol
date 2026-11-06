// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {CCIPReceiver} from "@chainlink/contracts-ccip/contracts/applications/CCIPReceiver.sol";
import {Client} from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {Actions} from "../shared/Actions.sol";
import {Ats, IAtsBond, IAtsExternalKycList, IAtsFactory} from "./ats/IAts.sol";
import {Isin} from "./Isin.sol";

interface IHederaTokenService {
    function associateToken(address account, address token) external returns (int64 responseCode);
}

/// @title DealManager
/// @notice Finances certified bills (invoices, client-certified milestone bills) on Hedera.
///
///         Chainlink CRE checks the off-chain facts and its signed reports arrive over CCIP from
///         the CreRelay on Avalanche Fuji. This contract applies them, but still enforces its own
///         rules: grade and discount limits, single-use documents and payment references, frozen
///         businesses, due dates, and USDC that must already be here.
///
///         Each deal is an ATS bond that this contract deploys and administers. Investors pay USDC
///         and receive bond units 1:1. Once a deal is fully funded the business is paid. The buyer
///         repays the bill's face value and holders redeem their units for their share of it.
///
///         This contract is also the external KYC list of every bond, so only investors that CRE
///         has verified can hold any of them.
contract DealManager is CCIPReceiver, Ownable, ReentrancyGuard, IAtsExternalKycList {
    using SafeERC20 for IERC20;

    enum Status {
        None,
        Approved, // CRE approved the bill; no bond yet
        Open, // bond deployed, taking investment
        Active, // fully funded, business paid, waiting for the buyer
        Repaid, // buyer paid; holders can redeem
        Late, // past due and unpaid; bond paused
        Defaulted,
        Expired // due date passed before full funding; holders get their USDC back
    }

    struct Deal {
        address business;
        Status status;
        uint8 grade; // 1 = A (best) ... 5 = E
        uint16 discountBps; // investors fund faceValue minus this discount
        uint64 dueDate; // when the buyer must pay
        uint256 fundedAt;
        uint256 repaidAt;
        uint256 faceValue; // what the buyer owes, USDC units
        uint256 target; // what investors fund and the business receives
        uint256 funded;
        uint256 repaidAmount;
        bytes32 docHash; // hash of the verified document set
        address bond;
        string ref; // public reference, e.g. "INV-2026-0142"
    }

    IHederaTokenService internal constant HTS = IHederaTokenService(address(0x167));
    int64 internal constant HTS_SUCCESS = 22;
    uint8 internal constant USDC_DECIMALS = 6;

    uint64 public immutable sourceChainSelector;
    IERC20 public immutable usdc;
    IAtsFactory public immutable atsFactory;
    address public immutable atsResolver;

    /// @notice CreRelay on the source chain; the only accepted CCIP sender.
    address public relay;
    uint8 public maxGrade = 4;
    uint16 public maxDiscountBps = 2000;
    bool public fundingPaused;

    uint256 public dealCount;
    uint256 public pingCount;
    /// @notice USDC held here that is owed to a deal or its holders.
    uint256 public reserved;

    mapping(uint256 => Deal) private s_deals;
    mapping(address => bool) public isVerified;
    mapping(address => bool) public frozenBusiness;
    /// @notice Late or defaulted deals per business; it is unfrozen when this returns to zero.
    mapping(address => uint256) public delinquentDeals;
    /// @notice Document hashes and payment references, each usable once.
    mapping(bytes32 => bool) public usedRef;

    event ReportReceived(bytes32 indexed messageId, uint8 indexed action);
    event Pinged(bytes32 indexed messageId, string note, uint256 sentAt, uint256 receivedAt);
    event DealApproved(
        uint256 indexed dealId,
        address indexed business,
        string ref,
        uint8 grade,
        uint16 discountBps,
        uint256 faceValue,
        uint256 target,
        uint64 dueDate,
        bytes32 docHash
    );
    event DealOpened(uint256 indexed dealId, address bond, string isin);
    event Invested(uint256 indexed dealId, address indexed investor, uint256 amount);
    event Disbursed(uint256 indexed dealId, address indexed business, uint256 amount);
    event Repaid(uint256 indexed dealId, uint256 amount, bytes32 paymentRef);
    event Redeemed(uint256 indexed dealId, address indexed investor, uint256 units, uint256 payout);
    event StatusChanged(uint256 indexed dealId, Status status);
    event BusinessFrozen(address indexed business, uint256 indexed dealId);
    event BusinessUnfrozen(address indexed business, uint256 indexed dealId);
    event InvestorVerified(address indexed investor, bool verified, bytes32 kycRef);
    event Reconciled(bool ok, uint256 offchainBalance, uint256 reserved, bytes32 snapshotHash);
    event FundingPaused(bool paused);
    event RelaySet(address relay);
    event PolicySet(uint8 maxGrade, uint16 maxDiscountBps);
    event TokenAssociated(address token);

    error UnknownSource(uint64 chainSelector);
    error UnknownSender(address sender);
    error UnknownAction(uint8 action);
    error AssociationFailed(address token, int64 responseCode);
    error ZeroAddress();
    error ZeroAmount();
    error PolicyRejected(uint8 grade, uint16 discountBps);
    error RefUsed(bytes32 ref);
    error Frozen(address business);
    error BadStatus(uint256 dealId, Status status);
    error FundingIsPaused();
    error NotVerified(address investor);
    error OverTarget(uint256 remaining);
    error PastDue(uint64 dueDate);
    error NotDueYet(uint64 dueDate);
    error InsufficientUnallocated(uint256 available, uint256 needed);
    error NothingToRedeem();
    error BondCallFailed(address bond);

    constructor(
        address router_,
        uint64 sourceChainSelector_,
        address usdc_,
        address atsFactory_,
        address atsResolver_
    ) CCIPReceiver(router_) Ownable(msg.sender) {
        if (usdc_ == address(0) || atsFactory_ == address(0) || atsResolver_ == address(0)) revert ZeroAddress();
        sourceChainSelector = sourceChainSelector_;
        usdc = IERC20(usdc_);
        atsFactory = IAtsFactory(atsFactory_);
        atsResolver = atsResolver_;
    }

    // ---------------------------------------------------------------------
    // CRE reports over CCIP
    // ---------------------------------------------------------------------

    function _ccipReceive(Client.Any2EVMMessage memory message) internal override {
        if (message.sourceChainSelector != sourceChainSelector) {
            revert UnknownSource(message.sourceChainSelector);
        }
        address sender = abi.decode(message.sender, (address));
        if (sender != relay) revert UnknownSender(sender);

        (uint8 action, bytes memory payload) = abi.decode(message.data, (uint8, bytes));
        emit ReportReceived(message.messageId, action);

        if (action == Actions.PING) _ping(message.messageId, payload);
        else if (action == Actions.APPROVE_DEAL) _approveDeal(payload);
        else if (action == Actions.VERIFY_INVESTOR) _verifyInvestor(payload);
        else if (action == Actions.CONFIRM_REPAYMENT) _confirmRepayment(payload);
        else if (action == Actions.MARK_LATE) _markLate(payload);
        else if (action == Actions.RECONCILE) _reconcile(payload);
        else revert UnknownAction(action);
    }

    function _ping(bytes32 messageId, bytes memory payload) internal {
        (string memory note, uint256 sentAt) = abi.decode(payload, (string, uint256));
        pingCount++;
        emit Pinged(messageId, note, sentAt, block.timestamp);
    }

    function _approveDeal(bytes memory payload) internal {
        (
            address business,
            uint8 grade,
            uint16 discountBps,
            uint64 dueDate,
            uint256 faceValue,
            bytes32 docHash,
            string memory ref
        ) = abi.decode(payload, (address, uint8, uint16, uint64, uint256, bytes32, string));

        if (business == address(0)) revert ZeroAddress();
        if (frozenBusiness[business]) revert Frozen(business);
        // Policy is enforced here, never taken on trust from the report.
        if (grade == 0 || grade > maxGrade || discountBps == 0 || discountBps > maxDiscountBps) {
            revert PolicyRejected(grade, discountBps);
        }
        if (faceValue == 0) revert ZeroAmount();
        // Due dates are minutes to months away; Hedera timestamps come from consensus.
        // forge-lint: disable-next-line(block-timestamp)
        if (dueDate <= block.timestamp) revert PastDue(dueDate);
        _useRef(docHash);

        uint256 dealId = ++dealCount;
        Deal storage d = s_deals[dealId];
        d.business = business;
        d.status = Status.Approved;
        d.grade = grade;
        d.discountBps = discountBps;
        d.dueDate = dueDate;
        d.faceValue = faceValue;
        d.target = faceValue * (10_000 - discountBps) / 10_000;
        d.docHash = docHash;
        d.ref = ref;

        emit DealApproved(dealId, business, ref, grade, discountBps, faceValue, d.target, dueDate, docHash);
        emit StatusChanged(dealId, Status.Approved);
    }

    function _verifyInvestor(bytes memory payload) internal {
        (address investor, bool verified, bytes32 kycRef) = abi.decode(payload, (address, bool, bytes32));
        if (investor == address(0)) revert ZeroAddress();
        isVerified[investor] = verified;
        emit InvestorVerified(investor, verified, kycRef);
    }

    /// @dev A repayment made off-chain (bank transfer) and confirmed by CRE. The operator must
    ///      already have converted it to USDC and sent it here.
    function _confirmRepayment(bytes memory payload) internal {
        (uint256 dealId, uint256 amount, bytes32 paymentRef) =
            abi.decode(payload, (uint256, uint256, bytes32));
        uint256 available = unallocated();
        if (available < amount) revert InsufficientUnallocated(available, amount);
        if (_repay(dealId, amount, paymentRef)) _unpause(s_deals[dealId].bond);
    }

    function _markLate(bytes memory payload) internal {
        (uint256 dealId, bool defaulted) = abi.decode(payload, (uint256, bool));
        Deal storage d = s_deals[dealId];
        if (d.status != Status.Active && d.status != Status.Late) revert BadStatus(dealId, d.status);
        // forge-lint: disable-next-line(block-timestamp)
        if (block.timestamp <= d.dueDate) revert NotDueYet(d.dueDate);

        // Late -> Defaulted escalates a deal already counted.
        if (d.status == Status.Active) delinquentDeals[d.business] += 1;
        Status s = defaulted ? Status.Defaulted : Status.Late;
        d.status = s;
        emit StatusChanged(dealId, s);
        if (!frozenBusiness[d.business]) {
            frozenBusiness[d.business] = true;
            emit BusinessFrozen(d.business, dealId);
        }
        // Units stop moving while the deal is delinquent.
        IAtsBond bond = IAtsBond(d.bond);
        if (!bond.paused() && !bond.pause()) revert BondCallFailed(d.bond);
    }

    function _reconcile(bytes memory payload) internal {
        (bool ok, uint256 offchainBalance, bytes32 snapshotHash) =
            abi.decode(payload, (bool, uint256, bytes32));
        emit Reconciled(ok, offchainBalance, reserved, snapshotHash);
        if (!ok && !fundingPaused) {
            fundingPaused = true;
            emit FundingPaused(true);
        }
    }

    // ---------------------------------------------------------------------
    // Deal lifecycle
    // ---------------------------------------------------------------------

    /// @notice Deploys the deal's ATS bond. A separate transaction from the approval because the
    ///         deployment needs about 8M gas, more than a CCIP message carries.
    function openDeal(uint256 dealId) external onlyOwner returns (address bond) {
        Deal storage d = s_deals[dealId];
        if (d.status != Status.Approved) revert BadStatus(dealId, d.status);

        string memory isin = Isin.forId(dealId);
        d.status = Status.Open;
        bond = atsFactory.deployBond(_bondData(dealId, d, isin), _regulationData());
        d.bond = bond;
        // The bond address only exists once the trusted factory returns.
        // forge-lint: disable-next-line(reentrancy-events)
        emit DealOpened(dealId, bond, isin);
        // forge-lint: disable-next-line(reentrancy-events)
        emit StatusChanged(dealId, Status.Open);
    }

    /// @notice Fund an open deal with USDC (approve this contract first). Bond units are issued
    ///         1:1; the bond itself refuses holders this contract has not verified.
    function invest(uint256 dealId, uint256 amount) external nonReentrant {
        Deal storage d = s_deals[dealId];
        if (fundingPaused) revert FundingIsPaused();
        if (d.status != Status.Open) revert BadStatus(dealId, d.status);
        if (frozenBusiness[d.business]) revert Frozen(d.business);
        if (!isVerified[msg.sender]) revert NotVerified(msg.sender);
        // forge-lint: disable-next-line(block-timestamp)
        if (block.timestamp >= d.dueDate) revert PastDue(d.dueDate);
        if (amount == 0) revert ZeroAmount();
        uint256 remaining = d.target - d.funded;
        if (amount > remaining) revert OverTarget(remaining);

        // All state first; the USDC and bond calls come last.
        d.funded += amount;
        bool complete = d.funded == d.target;
        emit Invested(dealId, msg.sender, amount);
        if (complete) {
            d.status = Status.Active;
            d.fundedAt = block.timestamp;
            reserved -= d.target - amount; // earlier investments leave with the payout
            emit StatusChanged(dealId, Status.Active);
            emit Disbursed(dealId, d.business, d.target);
        } else {
            // Bookkeeping only; the Invested event records the change.
            // forge-lint: disable-next-line(missing-events-arithmetic)
            reserved += amount;
        }

        // `_status` in these findings is the reentrancy guard's own flag; the guard covers them.
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        // forge-lint: disable-next-line(reentrancy-no-eth)
        IAtsBond(d.bond).issue(msg.sender, amount, "");
        if (complete) usdc.safeTransfer(d.business, d.target);
    }

    /// @notice The buyer repays the bill's face value in USDC (approve this contract first).
    function repay(uint256 dealId) external nonReentrant {
        Deal storage d = s_deals[dealId];
        bool wasPaused = _repay(dealId, d.faceValue, bytes32(0));
        usdc.safeTransferFrom(msg.sender, address(this), d.faceValue);
        // forge-lint: disable-next-line(reentrancy-no-eth)
        if (wasPaused) _unpause(d.bond);
    }

    /// @notice Close a deal that reached its due date without full funding. Anyone can call it;
    ///         holders then redeem their units 1:1 for the USDC they put in.
    function expire(uint256 dealId) external {
        Deal storage d = s_deals[dealId];
        if (d.status != Status.Approved && d.status != Status.Open) revert BadStatus(dealId, d.status);
        // forge-lint: disable-next-line(block-timestamp)
        if (block.timestamp < d.dueDate) revert NotDueYet(d.dueDate);
        d.status = Status.Expired;
        emit StatusChanged(dealId, Status.Expired);
    }

    /// @notice Redeem every unit the caller holds: its share of the repayment, or a 1:1 refund
    ///         if the deal expired unfunded.
    function redeem(uint256 dealId) external nonReentrant {
        Deal storage d = s_deals[dealId];
        if (d.status != Status.Repaid && d.status != Status.Expired) revert BadStatus(dealId, d.status);
        IAtsBond bond = IAtsBond(d.bond);
        uint256 units = bond.balanceOf(msg.sender);
        if (units == 0) revert NothingToRedeem();

        uint256 payout = d.status == Status.Repaid ? units * d.repaidAmount / d.target : units;
        reserved -= payout;
        emit Redeemed(dealId, msg.sender, units, payout);

        // forge-lint: disable-next-line(reentrancy-no-eth)
        bond.controllerRedeem(msg.sender, units, "", "");
        usdc.safeTransfer(msg.sender, payout);
    }

    /// @return wasPaused whether the deal was late, so its paused bond must be unpaused.
    function _repay(uint256 dealId, uint256 amount, bytes32 paymentRef) internal returns (bool wasPaused) {
        Deal storage d = s_deals[dealId];
        if (d.status != Status.Active && d.status != Status.Late && d.status != Status.Defaulted) {
            revert BadStatus(dealId, d.status);
        }
        if (amount == 0) revert ZeroAmount();
        if (paymentRef != bytes32(0)) _useRef(paymentRef);

        wasPaused = d.status != Status.Active;
        d.status = Status.Repaid;
        d.repaidAt = block.timestamp;
        d.repaidAmount = amount;
        reserved += amount;
        emit Repaid(dealId, amount, paymentRef);
        emit StatusChanged(dealId, Status.Repaid);

        // Curing the last delinquent deal lets the business raise and receive funding again.
        if (wasPaused && --delinquentDeals[d.business] == 0) {
            frozenBusiness[d.business] = false;
            emit BusinessUnfrozen(d.business, dealId);
        }
    }

    /// @dev A late deal's units were paused; repayment lets holders redeem again.
    function _unpause(address bond) internal {
        // forge-lint: disable-next-line(reentrancy-no-eth)
        if (!IAtsBond(bond).unpause()) revert BondCallFailed(bond);
    }

    function _useRef(bytes32 ref) internal {
        if (usedRef[ref]) revert RefUsed(ref);
        usedRef[ref] = true;
    }

    function _bondData(uint256 dealId, Deal storage d, string memory isin)
        internal
        view
        returns (Ats.BondData memory data)
    {
        address[] memory self = new address[](1);
        self[0] = address(this);

        bytes32[7] memory roles = [
            Ats.ROLE_DEFAULT_ADMIN,
            Ats.ROLE_ISSUER,
            Ats.ROLE_PAUSER,
            Ats.ROLE_CONTROLLER,
            Ats.ROLE_MATURITY_REDEEMER,
            Ats.ROLE_MATURITY_MANAGER,
            Ats.ROLE_FREEZE_MANAGER
        ];
        Ats.Rbac[] memory rbacs = new Ats.Rbac[](roles.length);
        for (uint256 i = 0; i < roles.length; i++) {
            rbacs[i] = Ats.Rbac(roles[i], self);
        }

        string memory id = Strings.toString(dealId);
        data.security = Ats.SecurityData({
            resolver: atsResolver,
            maxSupply: d.target,
            resolverProxyConfiguration: Ats.ResolverProxyConfiguration(Ats.BOND_CONFIG_ID, 1),
            erc20MetadataInfo: Ats.ERC20MetadataInfo(
                string.concat("Bill ", d.ref), string.concat("BILL", id), isin, USDC_DECIMALS
            ),
            rbacs: rbacs,
            externalPauses: new address[](0),
            externalControlLists: new address[](0),
            externalKycLists: self,
            compliance: address(0),
            identityRegistry: address(0),
            arePartitionsProtected: false,
            isMultiPartition: false,
            isControllable: true,
            isWhiteList: false,
            clearingActive: false,
            internalKycActivated: false,
            erc20VotesActivated: false
        });
        data.bondDetails = Ats.BondDetailsData({
            currency: "USD",
            nominalValue: 1,
            nominalValueDecimals: USDC_DECIMALS,
            startingDate: block.timestamp,
            maturityDate: d.dueDate
        });
    }

    function _regulationData() internal pure returns (Ats.FactoryRegulationData memory) {
        return Ats.FactoryRegulationData(
            Ats.RegulationType.REG_S,
            Ats.RegulationSubType.NONE,
            Ats.AdditionalSecurityData(false, "", "Hackathon testnet data. Not a real security.")
        );
    }

    // ---------------------------------------------------------------------
    // ATS external KYC list
    // ---------------------------------------------------------------------

    /// @inheritdoc IAtsExternalKycList
    function getKycStatus(address account) external view override returns (Ats.KycStatus) {
        return
            isVerified[account] || account == address(this)
                ? Ats.KycStatus.GRANTED
                : Ats.KycStatus.NOT_GRANTED;
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    function getDeal(uint256 dealId) external view returns (Deal memory) {
        return s_deals[dealId];
    }

    /// @notice USDC here that no deal or holder is owed, e.g. an on-ramped repayment that CRE
    ///         has not confirmed yet.
    function unallocated() public view returns (uint256) {
        uint256 balance = usdc.balanceOf(address(this));
        return balance > reserved ? balance - reserved : 0;
    }

    // ---------------------------------------------------------------------
    // Owner
    // ---------------------------------------------------------------------

    function setRelay(address relay_) external onlyOwner {
        if (relay_ == address(0)) revert ZeroAddress();
        relay = relay_;
        emit RelaySet(relay_);
    }

    function setPolicy(uint8 maxGrade_, uint16 maxDiscountBps_) external onlyOwner {
        maxGrade = maxGrade_;
        maxDiscountBps = maxDiscountBps_;
        emit PolicySet(maxGrade_, maxDiscountBps_);
    }

    /// @notice Only the operator lifts the circuit breaker, after investigating the mismatch.
    function resumeFunding() external onlyOwner {
        fundingPaused = false;
        emit FundingPaused(false);
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
