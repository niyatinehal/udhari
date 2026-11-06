import { formatUnits } from "viem";
import { USD_DECIMALS } from "./chain";

const usdFormat = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const inrFormat = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export const usd = (units: string | bigint) => usdFormat.format(Number(formatUnits(BigInt(units), USD_DECIMALS)));
export const inr = (paise: number) => inrFormat.format(paise / 100);
export const short = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;
export const shortHash = (hash: string) => `${hash.slice(0, 10)}…${hash.slice(-6)}`;

export const date = (unix: number) =>
  new Date(unix * 1000).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export const day = (unix: number) => new Date(unix * 1000).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

export const relative =(unix: number, now = Date.now() / 1000) => {
  const s = Math.round(unix - now);
  const abs = Math.abs(s);
  const [n, unit] =
    abs < 90 ? [abs, "s"] : abs < 5400 ? [Math.round(abs / 60), "min"] : abs < 129600 ? [Math.round(abs / 3600), "h"] : [Math.round(abs / 86400), "d"];
  return s >= 0 ? `in ${n} ${unit}` : `${n} ${unit} ago`;
};

/** Annualised return of buying at a discount and being repaid face value at maturity. */
export const yieldPa = (discountBps: number, fromUnix: number, dueUnix: number) => {
  const days = Math.max((dueUnix - fromUnix) / 86400, 1 / 24);
  const r = discountBps / (10_000 - discountBps);
  return (r * 365) / days;
};

export const pct = (x: number) => `${(x * 100).toFixed(x >= 1 ? 0 : 1)}%`;
