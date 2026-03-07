import type { Transfer } from "./notion";

export interface CurrencyFlow {
    currency: string;
    inflow: number;
    outflow: number;
    net: number;
    twdInflow: number;
    twdOutflow: number;
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
    twdNet: number;
    hasAllRates: boolean;
}

export interface AccountPerformance {
    accountKey: string;
    currentAmount: number | null;
    currency: string;
    netCost: number; // in Account Currency
    pl: number | null; // in Account Currency
    yieldPercentage: number | null;
    netCostTwd: number;
    plTwd: number | null;
}

const STABLE_USD = new Set(["USD", "USDT", "USDC"]);
const HARDCODED_USD_RATE = 31.5;

type FlowEntry = {
    inflow: number;
    outflow: number;
    twdInflow: number;
    twdOutflow: number;
    hasRate: boolean;
};

export function computeAccountFlows(transfers: Transfer[], mergeUsd: boolean): AccountFlow[] {
    const raw: Record<string, Record<string, FlowEntry>> = {};
    const records: Record<string, AccountRecord[]> = {};

    const ensure = (map: Record<string, Record<string, FlowEntry>>, account: string, currency: string) => {
        if (!map[account]) map[account] = {};
        if (!map[account][currency]) {
            map[account][currency] = {
                inflow: 0,
                outflow: 0,
                twdInflow: 0,
                twdOutflow: 0,
                hasRate: true,
            };
        }
        if (!records[account]) records[account] = [];
    };

    const toTwd = (amount: number, currency: string, exchangeRate: number | null): { twd: number; hasRate: boolean; } => {
        if (currency === "TWD") return { twd: amount, hasRate: true };

        // Use user-provided hardcoded rate for USD/USDT/USDC for now
        if (STABLE_USD.has(currency)) {
            return { twd: amount * HARDCODED_USD_RATE, hasRate: true };
        }

        if (exchangeRate != null) return { twd: amount * exchangeRate, hasRate: true };

        return { twd: 0, hasRate: false };
    };

    for (const t of transfers) {
        const amount = t.amount ?? 0;
        const fee = t.fee ?? 0;
        const currency = t.currency || "unknown";

        if (t.from) {
            ensure(raw, t.from, currency);
            const entry = raw[t.from][currency];
            entry.outflow += amount + fee;
            const { twd, hasRate } = toTwd(amount + fee, currency, t.exchangeRate);
            entry.twdOutflow += twd;
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
            const { twd, hasRate } = toTwd(amount, currency, t.exchangeRate);
            entry.twdInflow += twd;
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
            twdInflow: v.twdInflow,
            twdOutflow: v.twdOutflow,
        }));

    const mergeCurrencies = (entries: Record<string, FlowEntry>): Record<string, FlowEntry> => {
        if (!mergeUsd) return entries;
        const merged: Record<string, FlowEntry> = {};
        for (const [currency, v] of Object.entries(entries)) {
            const key = STABLE_USD.has(currency) ? "USD" : currency;
            if (!merged[key]) merged[key] = { inflow: 0, outflow: 0, twdInflow: 0, twdOutflow: 0, hasRate: true };
            merged[key].inflow += v.inflow;
            merged[key].outflow += v.outflow;
            merged[key].twdInflow += v.twdInflow;
            merged[key].twdOutflow += v.twdOutflow;
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
            const twdNet = details.reduce((sum, c) => sum + (c.twdInflow - c.twdOutflow), 0);
            const sortedRecords = (records[account] || []).sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
            return { account, summary, details, records: sortedRecords, twdNet, hasAllRates };
        })
        .sort((a, b) => a.account.localeCompare(b.account));
}

export function calculatePerformance(
    accountKey: string,
    amount: number | null,
    currency: string,
    flows: AccountFlow[],
): AccountPerformance {
    const flow = flows.find(f => f.account === accountKey);

    // Net Cost = (Inflow - Outflow) in TWD
    const netCostTwd = flow ? flow.twdNet : 0;

    let currentTwd: number | null = null;
    if (amount != null) {
        if (currency === "TWD") {
            currentTwd = amount;
        } else if (STABLE_USD.has(currency)) {
            currentTwd = amount * HARDCODED_USD_RATE;
        }
    }

    const plTwd = currentTwd !== null ? currentTwd - netCostTwd : null;

    // Native calculations
    // Calculate native net cost by converting the total TWD net cost back to the desired currency
    let netCostNative = 0;
    if (currency === "TWD") {
        netCostNative = netCostTwd;
    } else if (STABLE_USD.has(currency)) {
        netCostNative = netCostTwd / HARDCODED_USD_RATE;
    } else {
        // Fallback to purely native flow if we don't have a conversion rate
        const nativeKey = STABLE_USD.has(currency) ? "USD" : currency;
        const nativeFlow = flow?.summary.find(s => s.currency === nativeKey);
        netCostNative = nativeFlow ? nativeFlow.net : 0;
    }

    const plNative = amount !== null ? amount - netCostNative : null;

    let yieldPercentage: number | null = null;
    // Use TWD basis for yield as it's more stable across multi-currency infusions
    if (plTwd !== null && netCostTwd > 0) {
        yieldPercentage = (plTwd / netCostTwd) * 100;
    } else if (plTwd !== null && netCostTwd === 0 && currentTwd !== null && currentTwd > 0) {
        yieldPercentage = 100;
    }

    return {
        accountKey,
        currentAmount: amount,
        currency,
        netCost: netCostNative,
        pl: plNative,
        yieldPercentage,
        netCostTwd,
        plTwd,
    };
}
