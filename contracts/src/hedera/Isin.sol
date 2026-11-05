// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @notice Builds placeholder ISINs ("ZZ" country code, reserved for testing) with a valid
///         check digit, which the ATS factory verifies.
library Isin {
    /// @return isin "ZZ" + the id as 9 zero-padded digits + the check digit.
    function forId(uint256 id) internal pure returns (string memory isin) {
        bytes memory body = new bytes(11);
        body[0] = "Z";
        body[1] = "Z";
        uint256 n = id;
        for (uint256 i = 10; i >= 2; i--) {
            // A single decimal digit always fits.
            // forge-lint: disable-next-line(unsafe-typecast)
            body[i] = bytes1(uint8(48 + (n % 10)));
            n /= 10;
        }
        // forge-lint: disable-next-line(unsafe-typecast)
        isin = string(abi.encodePacked(body, bytes1(uint8(48 + checkDigit(body)))));
    }

    /// @dev ISIN check digit: letters become their base-36 value (A = 10 ... Z = 35), then the
    ///      Luhn algorithm runs over the resulting digits, doubling from the rightmost one.
    function checkDigit(bytes memory body) internal pure returns (uint256) {
        bytes memory digits = "";
        for (uint256 i = 0; i < body.length; i++) {
            uint8 c = uint8(body[i]);
            if (c >= 65) {
                uint8 v = c - 55;
                digits = abi.encodePacked(digits, bytes1(48 + v / 10), bytes1(48 + (v % 10)));
            } else {
                digits = abi.encodePacked(digits, body[i]);
            }
        }
        uint256 sum = 0;
        bool doubleIt = true;
        for (uint256 i = digits.length; i > 0; i--) {
            uint256 d = uint8(digits[i - 1]) - 48;
            if (doubleIt) {
                d *= 2;
                if (d > 9) d -= 9;
            }
            sum += d;
            doubleIt = !doubleIt;
        }
        return (10 - (sum % 10)) % 10;
    }
}
