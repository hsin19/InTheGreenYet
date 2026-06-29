import type { AccountConfig } from "@/hooks/useAppData";
import { renderWithI18n } from "@/test/render";
import { useState } from "react";
import {
    describe,
    expect,
    it,
    vi,
} from "vitest";
import { page } from "vitest/browser";
import { AccountDialog } from "./AccountDialog";

interface HarnessProps {
    editingKey?: string | null;
    existingConfig?: AccountConfig;
    existingKeys?: string[];
    availableCurrencies?: string[];
    onSave?: (key: string, config: AccountConfig) => Promise<void>;
}

function Harness({
    editingKey = null,
    existingConfig,
    existingKeys = [],
    availableCurrencies = ["USD", "TWD"],
    onSave = async () => {},
}: HarnessProps) {
    const [open, setOpen] = useState(true);
    return (
        <div>
            <span data-testid="open">{String(open)}</span>
            <AccountDialog
                open={open}
                onOpenChange={setOpen}
                editingKey={editingKey}
                existingConfig={existingConfig}
                existingKeys={existingKeys}
                availableCurrencies={availableCurrencies}
                onSave={onSave}
            />
        </div>
    );
}

async function pickFromSelect(name: RegExp, optionName: string | RegExp) {
    await page.getByRole("combobox", { name }).click();
    await page.getByRole("option", { name: optionName }).click();
}

describe("AccountDialog", () => {
    it("requires a key in create mode", async () => {
        renderWithI18n(<Harness />);
        await expect.element(page.getByText("New Account")).toBeVisible();

        await page.getByRole("button", { name: "Save" }).click();
        await expect.element(page.getByText("Key is required")).toBeVisible();
    });

    it("rejects a duplicate key", async () => {
        renderWithI18n(<Harness existingKeys={["binance"]} />);

        await page.getByLabelText("Key").fill("binance");
        await page.getByRole("button", { name: "Save" }).click();

        await expect.element(page.getByText(/already exists/)).toBeVisible();
    });

    it("requires a currency", async () => {
        renderWithI18n(<Harness />);

        await page.getByLabelText("Key").fill("cash");
        await page.getByRole("button", { name: "Save" }).click();

        await expect.element(page.getByText("Currency is required")).toBeVisible();
    });

    it("creates a plain account and closes", async () => {
        const onSave = vi.fn().mockResolvedValue(undefined);
        renderWithI18n(<Harness onSave={onSave} />);

        await page.getByLabelText("Key").fill("cash");
        await page.getByLabelText("Display Name").fill("My Cash");
        await pickFromSelect(/currency/i, "USD");

        await page.getByRole("button", { name: "Save" }).click();

        await vi.waitFor(() => {
            expect(onSave).toHaveBeenCalledWith(
                "cash",
                expect.objectContaining({
                    displayName: "My Cash",
                    currency: "USD",
                    accountType: "bank",
                }),
            );
        });
        await expect.element(page.getByTestId("open")).toHaveTextContent("false");
    });

    it("reveals provider credential fields for an API account and saves them", async () => {
        const onSave = vi.fn().mockResolvedValue(undefined);
        renderWithI18n(<Harness onSave={onSave} />);

        await page.getByLabelText("Key").fill("bn");
        await pickFromSelect(/currency/i, "USD");
        await pickFromSelect(/account type/i, "Binance");

        // The provider connect box appears once a known provider is selected.
        await expect.element(page.getByText("Connect to Binance")).toBeVisible();
        await page.getByLabelText("API Key").fill("pub");
        await page.getByLabelText("API Secret").fill("sec");

        await page.getByRole("button", { name: "Save" }).click();

        await vi.waitFor(() => {
            expect(onSave).toHaveBeenCalledWith(
                "bn",
                expect.objectContaining({
                    accountType: "binance",
                    apiKey: "pub",
                    apiSecret: "sec",
                }),
            );
        });
    });

    it("edits an existing account without a key field", async () => {
        const onSave = vi.fn().mockResolvedValue(undefined);
        renderWithI18n(
            <Harness
                editingKey="cash"
                existingConfig={{ displayName: "Cash", currency: "USD", accountType: "bank" }}
                onSave={onSave}
            />,
        );

        await expect.element(page.getByText('Edit "cash"')).toBeVisible();
        await page.getByLabelText("Display Name").fill("Renamed");
        await page.getByRole("button", { name: "Save" }).click();

        await vi.waitFor(() => {
            expect(onSave).toHaveBeenCalledWith("cash", expect.objectContaining({ displayName: "Renamed" }));
        });
    });
});
