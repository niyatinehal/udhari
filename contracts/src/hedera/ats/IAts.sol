// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @notice The parts of Hedera's Asset Tokenization Studio (ATS) this project uses.
///         Struct layouts match the factory deployed on Hedera testnet (0.0.9213391), which
///         predates the layout on the ATS main branch. The deployBond selector is 0x29002951.
library Ats {
    bytes32 internal constant ROLE_DEFAULT_ADMIN = 0x00;
    bytes32 internal constant ROLE_ISSUER =
        0x5eeaf5602c75bf26e73b5206d0bd6ee82f621166255e5fd73cc06bc7bd84a95f;
    bytes32 internal constant ROLE_PAUSER =
        0x3cb8b459fdb6e7dc3d2a2aa529e530f885d45e03584adb438423209c86a2731f;
    bytes32 internal constant ROLE_CONTROLLER =
        0xb4d2b850c3ed8a234d390d5c157bbb1824883213c335ffe2a0f0761bb168713e;
    bytes32 internal constant ROLE_MATURITY_REDEEMER =
        0x433f48f8aca23480f6ab07666cbc9131d32a0b4672033453f65e18f4dd390523;
    bytes32 internal constant ROLE_MATURITY_MANAGER =
        0xc20b7fd7efe1a2c9f69003a21c2c55c79ef84e16252b62599246ff01f6207314;
    bytes32 internal constant ROLE_FREEZE_MANAGER =
        0x71ae38482e1ab1c28e767d64766d686215b490c8c1bd7dfe6b101525187c2155;

    /// @notice Resolver configuration id for bonds.
    bytes32 internal constant BOND_CONFIG_ID = bytes32(uint256(2));

    enum KycStatus {
        NOT_GRANTED,
        GRANTED
    }

    enum RegulationType {
        NONE,
        REG_S,
        REG_D
    }

    enum RegulationSubType {
        NONE,
        REG_D_506_B,
        REG_D_506_C
    }

    struct ResolverProxyConfiguration {
        bytes32 key;
        uint256 version;
    }

    struct ERC20MetadataInfo {
        string name;
        string symbol;
        string isin;
        uint8 decimals;
    }

    struct Rbac {
        bytes32 role;
        address[] members;
    }

    struct SecurityData {
        address resolver;
        uint256 maxSupply;
        ResolverProxyConfiguration resolverProxyConfiguration;
        ERC20MetadataInfo erc20MetadataInfo;
        Rbac[] rbacs;
        address[] externalPauses;
        address[] externalControlLists;
        address[] externalKycLists;
        address compliance;
        address identityRegistry;
        bool arePartitionsProtected;
        bool isMultiPartition;
        bool isControllable;
        bool isWhiteList;
        bool clearingActive;
        bool internalKycActivated;
        bool erc20VotesActivated;
    }

    struct BondDetailsData {
        bytes3 currency;
        uint256 nominalValue;
        uint8 nominalValueDecimals;
        uint256 startingDate;
        uint256 maturityDate;
    }

    struct BondData {
        SecurityData security;
        BondDetailsData bondDetails;
        address[] proceedRecipients;
        bytes[] proceedRecipientsData;
    }

    struct AdditionalSecurityData {
        bool countriesControlListType;
        string listOfCountries;
        string info;
    }

    struct FactoryRegulationData {
        RegulationType regulationType;
        RegulationSubType regulationSubType;
        AdditionalSecurityData additionalSecurityData;
    }
}

interface IAtsFactory {
    function deployBond(Ats.BondData calldata bondData, Ats.FactoryRegulationData calldata regulationData)
        external
        returns (address bond);
}

/// @notice One deal's bond. ATS answers unknown selectors with FunctionNotFound; every function
///         here was checked against the live bond facets.
interface IAtsBond {
    function issue(address tokenHolder, uint256 value, bytes calldata data) external;
    function controllerRedeem(
        address tokenHolder,
        uint256 value,
        bytes calldata data,
        bytes calldata operatorData
    ) external;
    function pause() external returns (bool);
    function unpause() external returns (bool);
    function paused() external view returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function totalSupply() external view returns (uint256);
}

/// @notice ATS asks every external KYC list whether an account may hold the security.
interface IAtsExternalKycList {
    function getKycStatus(address account) external view returns (Ats.KycStatus);
}
