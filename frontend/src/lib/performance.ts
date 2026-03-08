import type { Transfer } from "./notion";

export interface CurrencyFlow {
    currency: string;
    inflow: number;
    outflow: number;
    net: number;
    baseInflow: number;
    baseOutflow: number;
}

export interface AccountRecord {
    date: string | null;
    counterpart: string;
    amount: number;
    currency: string;
    direction: "in" | "out";
}

export interface AccountFlow {
    account: string;
    summary: CurrencyFlow[];
    details: CurrencyFlow[];
    records: AccountRecord[];
    baseNet: number;
    hasAllRates: boolean;
}

export interface AccountPerformance {
    accountKey: string;
    currentAmount: number | null;
    currency: string;
    netCost: number; // in Account Currency
    pl: number | null; // in Account Currency
    yieldPercentage: number | null;
    netCostBase: number;
    plBase: number | null;
}

const STABLE_USD = new Set(["USD", "USDT", "USDC"]);

type FlowEntry = {
    inflow: number;
    outflow: number;
    baseInflow: number;
    baseOutflow: number;
    hasRate: boolean;
};

export function computeAccountFlows(transfers: Transfer[], mergeUsd: boolean, getFiatToBaseRate: (currency: string) => number | null): AccountFlow[] {
    const raw: Record<string, Record<string, FlowEntry>> = {};
    const records: Record<string, AccountRecord[]> = {};

    const ensure = (map: Record<string, Record<string, FlowEntry>>, account: string, currency: string) => {
        if (!map[account]) map[account] = {};
        if (!map[account][currency]) {
            map[account][currency] = {
                inflow: 0,
                outflow: 0,
                baseInflow: 0,
                baseOutflow: 0,
                hasRate: true,
            };
        }
        if (!records[account]) records[account] = [];
    };

    const toBase = (amount: number, currency: string, explicitExchangeRate: number | null): { baseValue: number; hasRate: boolean; } => {
        // 1. Fallback to live centralized pricing (returns 1 if currency is already the base currency)
        const liveRate = getFiatToBaseRate(currency);

        // 2. Prefer explicitly recorded rate from the Notion transfer if exist
        const rateToUse = explicitExchangeRate != null ? explicitExchangeRate : liveRate;

        if (rateToUse != null) {
            return { baseValue: amount * rateToUse, hasRate: true };
        }

        return { baseValue: 0, hasRate: false };
    };

    for (const t of transfers) {
        const amount = t.amount ?? 0;
        const fee = t.fee ?? 0;
        const currency = t.currency || "unknown";

        if (t.from) {
            ensure(raw, t.from, currency);
            const entry = raw[t.from][currency];
            entry.outflow += amount + fee;
            const { baseValue, hasRate } = toBase(amount + fee, currency, t.exchangeRate);
            entry.baseOutflow += baseValue;
            if (!hasRate) entry.hasRate = false;
            records[t.from].push({
                date: t.date,
                counterpart: t.to || "—",
                amount: amount + fee,
                currency,
                direction: "out",
            });
        }
        if (t.to) {
            ensure(raw, t.to, currency);
            const entry = raw[t.to][currency];
            entry.inflow += amount;
            const { baseValue, hasRate } = toBase(amount, currency, t.exchangeRate);
            entry.baseInflow += baseValue;
            if (!hasRate) entry.hasRate = false;
            records[t.to].push({
                date: t.date,
                counterpart: t.from || "—",
                amount,
                currency,
                direction: "in",
            });
        }
    }

    const toFlows = (byCurrency: Record<string, FlowEntry>): CurrencyFlow[] =>
        Object.entries(byCurrency).map(([currency, v]) => ({
            currency,
            inflow: v.inflow,
            outflow: v.outflow,
            net: v.inflow - v.outflow,
            baseInflow: v.baseInflow,
            baseOutflow: v.baseOutflow,
        }));

    const mergeCurrencies = (entries: Record<string, FlowEntry>): Record<string, FlowEntry> => {
        if (!mergeUsd) return entries;
        const merged: Record<string, FlowEntry> = {};
        for (const [currency, v] of Object.entries(entries)) {
            const key = STABLE_USD.has(currency) ? "USD" : currency;
            if (!merged[key]) merged[key] = { inflow: 0, outflow: 0, baseInflow: 0, baseOutflow: 0, hasRate: true };
            merged[key].inflow += v.inflow;
            merged[key].outflow += v.outflow;
            merged[key].baseInflow += v.baseInflow;
            merged[key].baseOutflow += v.baseOutflow;
            if (!v.hasRate) merged[key].hasRate = false;
        }
        return merged;
    };

    return Object.entries(raw)
        .map(([account, byCurrency]) => {
            const details = toFlows(byCurrency);
            const mergedMap = mergeCurrencies(byCurrency);
            const summary = toFlows(mergedMap);
            const hasAllRates = Object.values(byCurrency).every(v => v.hasRate);
            const baseNet = details.reduce((sum, c) => sum + (c.baseInflow - c.baseOutflow), 0);
            const sortedRecords = (records[account] || []).sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
            return { account, summary, details, records: sortedRecords, baseNet, hasAllRates };
        })
        .sort((a, b) => a.account.localeCompare(b.account));
}

export function calculatePerformance(
    accountKey: string,
    amount: number | null,
    currency: string,
    flows: AccountFlow[],
    getFiatToBaseRate: (currency: string) => number | null,
): AccountPerformance {
    const flow = flows.find(f => f.account === accountKey);

    // Net Cost = (Inflow - Outflow) in Base Currency
    const netCostBase = flow ? flow.baseNet : 0;

    let currentBase: number | null = null;
    if (amount != null) {
        const liveRate = getFiatToBaseRate(currency);
        if (liveRate != null) {
            currentBase = amount * liveRate;
        }
    }

    const plBase = currentBase !== null ? currentBase - netCostBase : null;

    // Native calculations
    let netCostNative = 0;
    const liveRate = getFiatToBaseRate(currency);

    if (liveRate != null && liveRate > 0) {
        netCostNative = netCostBase / liveRate;
    } else {
        // Fallback to purely native flow if we don't have a conversion rate
        const nativeKey = STABLE_USD.has(currency) ? "USD" : currency;
        const nativeFlow = flow?.summary.find(s => s.currency === nativeKey);
        netCostNative = nativeFlow ? nativeFlow.net : 0;
    }

    const plNative = amount !== null ? amount - netCostNative : null;

    let yieldPercentage: number | null = null;
    // Use Base basis for yield as it's more stable across multi-currency infusions
    if (plBase !== null && netCostBase > 0) {
        yieldPercentage = (plBase / netCostBase) * 100;
    } else if (plBase !== null && netCostBase === 0 && currentBase !== null && currentBase > 0) {
        yieldPercentage = 100;
    }

    return {
        accountKey,
        currentAmount: amount,
        currency,
        netCost: netCostNative,
        pl: plNative,
        yieldPercentage,
        netCostBase,
        plBase,
    };
}
