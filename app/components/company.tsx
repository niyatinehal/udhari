"use client";

import { useState } from "react";
import { isAddressEqual } from "viem";
import { useConnection } from "wagmi";
import { short } from "@/lib/format";
import { api, errorMessage, useApi, useRefresh, useStored } from "@/lib/hooks";
import type { Company } from "@/lib/server/mock";
import { BuildingIcon } from "./icons";
import { Button, Choices, ErrorText, IconSquare, Row, Section, Sheet } from "./ui";

export type Party = Company & { wallet: `0x${string}` | null };

/**
 * The company the connected wallet acts for. Binding a wallet stands in for onboarding (KYB);
 * CRE checks a buyer's signature against the wallet bound here.
 */
export function useCompany(role: "seller" | "buyer") {
  const [gstin, setGstin] = useStored(`company:${role}`);
  const { data: parties } = useApi<Party[]>("/api/parties", 10_000);
  const options = parties?.filter((p) => p.role === role) ?? [];
  const company = options.find((p) => p.gstin === gstin) ?? null;
  return { company, options, setGstin };
}

export function CompanySection({ role, state }: { role: "seller" | "buyer"; state: ReturnType<typeof useCompany> }) {
  const { company, options, setGstin } = state;
  const { address } = useConnection();
  const refresh = useRefresh();
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bound = !!(company?.wallet && address && isAddressEqual(company.wallet, address));

  const bind = async () => {
    if (!company || !address) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/parties/${company.gstin}`, { method: "POST", body: { wallet: address } });
      refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section
      header={role === "seller" ? "Your business" : "Your company"}
      footer={
        company && !bound
          ? address
            ? "Link this wallet to act for the company. In production this happens after business verification."
            : "Connect a wallet to act for the company."
          : undefined
      }
    >
      <Row
        icon={
          <IconSquare tone={role === "seller" ? "blue" : "indigo"}>
            <BuildingIcon />
          </IconSquare>
        }
        title={company?.name ?? "Choose a company"}
        subtitle={company ? `GSTIN ${company.gstin} · ${company.city}` : undefined}
        detail={company?.wallet ? short(company.wallet) : undefined}
        onClick={() => setPicking(true)}
        chevron
      />
      {company && !bound && address && (
        <div className="px-4 py-3">
          <Button small loading={busy} onClick={bind}>
            Act for {company.name.split(" ")[0]} with {short(address)}
          </Button>
          <ErrorText error={error} />
        </div>
      )}
      <Sheet open={picking} onClose={() => setPicking(false)} title={role === "seller" ? "Business" : "Company"}>
        <Section>
          <Choices
            options={options.map((o) => ({ value: o.gstin, label: o.name, detail: `${o.sector} · ${o.city}` }))}
            value={company?.gstin ?? null}
            onChange={(v) => {
              setGstin(v);
              setPicking(false);
            }}
          />
        </Section>
      </Sheet>
    </Section>
  );
}
