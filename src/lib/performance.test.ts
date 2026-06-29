import type { Transfer } from "@shared/model";
import {
    describe,
    expect,
    it,
} from "vitest";
import {
    accountBaseValue,
    type AccountFlow,
    type AccountPerformance,
    calculatePerformance,
    computeAccountFlows,
    sortAccountKeys,
} from "./performance";

describe("Performance Calculations", () => {
    const mockGetFiatToBaseRate = (currency: string): number | null => {
        const cur = currency.toUpperCase();
        if (cur === "TWD") return 1;
        if (cur === "USD" || cur === "USDT" || cur === "USDC") return 31.0;
        return null;
    };

    describe("computeAccountFlows", () => {
        it("should calculate inflows and outflows correctly", () => {
            const transfers: Transfer[] = [
                {
                    id: "1",
                    title: "Deposit USD",
                    from: "",
                    to: "Binance",
                    amount: 1000,
                    currency: "USDT",
                    fee: 2,
                    exchangeRate: null,
                    date: "2026-05-01",
                    note: "Initial deposit",
                },
                {
                    id: "2",
                    title: "Transfer to Bank",
                    from: "Binance",
                    to: "Bank",
                    amount: 500,
                    currency: "USD",
                    fee: 0,
                    exchangeRate: null,
                    date: "2026-05-02",
                    note: "",
                },
            ];

            const flows = computeAccountFlows(transfers, false, mockGetFiatToBaseRate);

            expect(flows).toHaveLength(2);

            const bankFlow = flows.find(f => f.account === "Bank");
            const binanceFlow = flows.find(f => f.account === "Binance");

            expect(bankFlow).toBeDefined();
            expect(binanceFlow).toBeDefined();

            expect(bankFlow?.baseNet).toBe(500 * 31.0);
            expect(bankFlow?.records).toHaveLength(1);
            expect(bankFlow?.records[0]).toEqual({
                date: "2026-05-02",
                counterpart: "Binance",
                amount: 500,
                currency: "USD",
                direction: "in",
            });

            const usdtSummary = binanceFlow?.summary.find(s => s.currency === "USDT");
            const usdSummary = binanceFlow?.summary.find(s => s.currency === "USD");

            expect(usdtSummary?.net).toBe(1000);
            expect(usdSummary?.net).toBe(-500);

            expect(binanceFlow?.baseNet).toBe(15500);
        });

        it("should merge stable USD currencies (USD, USDT, USDC) when mergeUsd is true", () => {
            const transfers: Transfer[] = [
                {
                    id: "1",
                    from: "Bank",
                    to: "Binance",
                    amount: 100,
                    currency: "USDT",
                    date: "2026-05-01",
                    title: "T1",
                    fee: null,
                    exchangeRate: null,
                    note: "",
                },
                {
                    id: "2",
                    from: "Binance",
                    to: "Bank",
                    amount: 50,
                    currency: "USDC",
                    date: "2026-05-02",
                    title: "T2",
                    fee: null,
                    exchangeRate: null,
                    note: "",
                },
                {
                    id: "3",
                    from: "Binance",
                    to: "Bank",
                    amount: 20,
                    currency: "USD",
                    date: "2026-05-03",
                    title: "T3",
                    fee: null,
                    exchangeRate: null,
                    note: "",
                },
            ];

            const flowsMerged = computeAccountFlows(transfers, true, mockGetFiatToBaseRate);
            const binanceMerged = flowsMerged.find(f => f.account === "Binance");

            const usdSummary = binanceMerged?.summary.find(s => s.currency === "USD");
            expect(usdSummary).toBeDefined();
            expect(usdSummary?.inflow).toBe(100);
            expect(usdSummary?.outflow).toBe(70);
            expect(usdSummary?.net).toBe(30);

            const details = binanceMerged?.details;
            expect(details?.find(d => d.currency === "USDT")?.net).toBe(100);
            expect(details?.find(d => d.currency === "USDC")?.net).toBe(-50);
            expect(details?.find(d => d.currency === "USD")?.net).toBe(-20);
        });
    });

    describe("calculatePerformance", () => {
        it("should calculate yield percentage and PL correctly", () => {
            const mockFlows = [
                {
                    account: "Binance",
                    summary: [{ currency: "USD", inflow: 1000, outflow: 0, net: 1000, baseInflow: 31000, baseOutflow: 0 }],
                    details: [{ currency: "USD", inflow: 1000, outflow: 0, net: 1000, baseInflow: 31000, baseOutflow: 0 }],
                    records: [],
                    baseNet: 31000,
                    hasAllRates: true,
                },
            ];

            const perf = calculatePerformance(
                "Binance",
                1200,
                "USD",
                mockFlows as unknown as AccountFlow[],
                mockGetFiatToBaseRate,
            );

            expect(perf.netCostBase).toBe(31000);
            expect(perf.plBase).toBe(6200);
            expect(perf.yieldPercentage).toBe(20);
            expect(perf.netCost).toBe(1000);
            expect(perf.pl).toBe(200);
        });
    });

    describe("accountBaseValue", () => {
        it("returns netCostBase + plBase (current value in base currency)", () => {
            // No flows -> netCostBase 0; 100 USD @ 31 -> plBase 3100.
            const perf = calculatePerformance("x", 100, "USD", [], mockGetFiatToBaseRate);
            expect(accountBaseValue(perf)).toBe(3100);
        });

        it("returns -Infinity when the performance entry is missing", () => {
            expect(accountBaseValue(undefined)).toBe(-Infinity);
        });
    });

    describe("sortAccountKeys", () => {
        // Minimal performance carrying only the fields the sort reads.
        const perf = (netCostBase: number, plBase: number | null): AccountPerformance => ({
            accountKey: "x",
            currentAmount: null,
            currency: "USD",
            netCost: 0,
            pl: null,
            yieldPercentage: null,
            netCostBase,
            plBase,
        });
        it("places investment accounts before non-investment ones, regardless of value", () => {
            const accounts = {
                bank: { isInvestment: false }, // large net cost, but not an investment
                inv: { isInvestment: true }, // small balance, investment
            };
            const performances = { bank: perf(9999, null), inv: perf(0, 100) };

            expect(sortAccountKeys(accounts, performances)).toEqual(["inv", "bank"]);
        });

        it("treats an undefined isInvestment flag as an investment", () => {
            const accounts = { undef: {}, bank: { isInvestment: false } };
            const performances = { undef: perf(0, 100), bank: perf(9999, null) };

            expect(sortAccountKeys(accounts, performances)).toEqual(["undef", "bank"]);
        });

        it("ranks investment accounts by base value (balance), descending", () => {
            const accounts = { small: { isInvestment: true }, big: { isInvestment: true } };
            const performances = { small: perf(0, 1000), big: perf(0, 3100) };

            expect(sortAccountKeys(accounts, performances)).toEqual(["big", "small"]);
        });

        it("ranks non-investment accounts by net cost, not balance", () => {
            // 'a' has the larger balance (plBase) but the smaller net cost -> ranks lower.
            const accounts = { a: { isInvestment: false }, b: { isInvestment: false } };
            const performances = { a: perf(5000, 99999), b: perf(8000, 0) };

            expect(sortAccountKeys(accounts, performances)).toEqual(["b", "a"]);
        });
    });
});
