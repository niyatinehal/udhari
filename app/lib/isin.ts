// The ISIN DealManager gives each deal's bond: "ZZ", the deal id in nine digits, a check digit.
// Mirrors contracts/src/hedera/Isin.sol.

const checkDigit = (body: string) => {
  const digits = [...body].map((c) => (c >= "A" ? String(c.charCodeAt(0) - 55) : c)).join("");
  let sum = 0;
  let double = true;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return (10 - (sum % 10)) % 10;
};

export const isinFor = (dealId: number) => {
  const body = `ZZ${String(dealId).padStart(9, "0")}`;
  return `${body}${checkDigit(body)}`;
};
