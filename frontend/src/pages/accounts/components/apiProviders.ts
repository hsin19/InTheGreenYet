import { type AccountConfig } from "@/hooks/useAppData";
import { fetchBinanceBalance } from "@/lib/binance";
import { fetchBitgetBalance } from "@/lib/bitget";
import type { ProviderBalance } from "@/lib/model";
import type { ComponentType } from "react";
import { BinanceKeyGuide } from "./BinanceKeyGuide";
import { BitgetKeyGuide } from "./BitgetKeyGuide";

/**
 * Credential fields a provider can require — derived from every `api*` key on
 * AccountConfig, so adding e.g. `apiToken` there flows here automatically. Keep
 * credential fields prefixed `api` (and non-credential fields not) for this to hold.
 */
export type CredentialFieldName = Extract<keyof AccountConfig, `api${string}`>;

/** A secret credential, rendered as a password input. */
export interface CredentialField {
    kind?: "secret";
    name: CredentialFieldName;
    label: string;
}

/** A non-secret choice, rendered as a dropdown. Has a default so it's never "missing". */
export interface SelectField {
    kind: "select";
    name: CredentialFieldName;
    label: string;
    options: { value: string; label: string; }[];
    default: string;
}

export type ProviderField = CredentialField | SelectField;

/**
 * Describes a provider whose balance can be fetched live via the backend signing
 * proxy. Shared by AccountDialog (which credential inputs to show) and AccountCard
 * (how to fetch). `fields` is declarative so a new provider just lists what it needs —
 * the dialog renders an input per field, no per-provider UI branching. The fetch
 * functions live in lib/; this is only the UI/dispatch glue.
 */
export interface ApiProvider {
    label: string;
    fields: ProviderField[];
    /** Step-by-step guide for creating a read-only key on this provider. */
    guide: ComponentType;
    /** Short advice next to the guide link on what kind of key to create. */
    keyHint?: string;
    /** Optional caveat shown in the connect box (e.g. coverage limits of the API). */
    note?: string;
    fetchBalance: (config: AccountConfig) => Promise<ProviderBalance>;
}

const API_KEY: CredentialField = { name: "apiKey", label: "API Key" };
const API_SECRET: CredentialField = { name: "apiSecret", label: "API Secret" };
const PASSPHRASE: CredentialField = { name: "apiPassphrase", label: "Passphrase" };

const BITGET_ACCOUNT_MODE: SelectField = {
    kind: "select",
    name: "apiMode",
    label: "Account type",
    options: [{ value: "classic", label: "Classic Trading account" }],
    default: "classic",
};

export const API_PROVIDERS: Record<string, ApiProvider> = {
    binance: {
        label: "Binance",
        fields: [API_KEY, API_SECRET],
        guide: BinanceKeyGuide,
        keyHint: "Use a read-only key (disable Trading & Withdrawals).",
        fetchBalance: c => fetchBinanceBalance(c.apiKey!, c.apiSecret!, c.currency || "USDT"),
    },
    bitget: {
        label: "Bitget",
        fields: [BITGET_ACCOUNT_MODE, API_KEY, API_SECRET, PASSPHRASE],
        guide: BitgetKeyGuide,
        keyHint: "Set the key to Read-only (Select all is safe).",
        note: "Classic Trading account only, reported in USDT. On-chain Earn balances aren't included — Bitget's API doesn't expose them.",
        fetchBalance: c => fetchBitgetBalance(c.apiKey!, c.apiSecret!, c.apiPassphrase!),
    },
};

export function getApiProvider(accountType?: string): ApiProvider | undefined {
    return accountType ? API_PROVIDERS[accountType] : undefined;
}

/** True when the config has every secret field its provider requires (selects always have a default). */
export function hasCredentials(config: AccountConfig): boolean {
    const provider = getApiProvider(config.accountType);
    if (!provider) return false;
    return provider.fields
        .filter((f): f is CredentialField => f.kind !== "select")
        .every(f => !!config[f.name]);
}
