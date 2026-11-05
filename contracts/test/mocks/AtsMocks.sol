// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ats, IAtsExternalKycList, IAtsFactory} from "../../src/hedera/ats/IAts.sol";

contract MockUsdc is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @dev Behaves like an ATS bond for the calls DealManager makes: only the admin (DealManager)
///      issues, redeems and pauses, and holders must pass the external KYC list.
contract MockBond {
    address public immutable admin;
    IAtsExternalKycList public immutable kycList;
    uint256 public immutable maturityDate;
    string public isin;
    bool public paused;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;

    error NotAdmin();
    error KycNotGranted(address account);
    error TokenIsPaused();

    constructor(address admin_, address kycList_, uint256 maturityDate_, string memory isin_) {
        admin = admin_;
        kycList = IAtsExternalKycList(kycList_);
        maturityDate = maturityDate_;
        isin = isin_;
    }

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    function issue(address holder, uint256 value, bytes calldata) external onlyAdmin {
        if (paused) revert TokenIsPaused();
        if (kycList.getKycStatus(holder) != Ats.KycStatus.GRANTED) revert KycNotGranted(holder);
        balanceOf[holder] += value;
        totalSupply += value;
    }

    function controllerRedeem(address holder, uint256 value, bytes calldata, bytes calldata)
        external
        onlyAdmin
    {
        if (paused) revert TokenIsPaused();
        balanceOf[holder] -= value;
        totalSupply -= value;
    }

    function pause() external onlyAdmin returns (bool) {
        paused = true;
        return true;
    }

    function unpause() external onlyAdmin returns (bool) {
        paused = false;
        return true;
    }
}

contract MockAtsFactory is IAtsFactory {
    Ats.BondData internal s_last;

    function deployBond(Ats.BondData calldata data, Ats.FactoryRegulationData calldata)
        external
        returns (address)
    {
        s_last = data;
        return address(
            new MockBond(
                data.security.rbacs[0].members[0],
                data.security.externalKycLists[0],
                data.bondDetails.maturityDate,
                data.security.erc20MetadataInfo.isin
            )
        );
    }

    function lastMaxSupply() external view returns (uint256) {
        return s_last.security.maxSupply;
    }

    function lastRoleCount() external view returns (uint256) {
        return s_last.security.rbacs.length;
    }
}
