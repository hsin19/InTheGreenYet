import type { AccountConfig } from "@/hooks/useAppData";
import { renderWithI18n } from "@/test/render";
import {
    describe,
    expect,
    it,
    vi,
} from "vitest";
import { page } from "vitest/browser";
import { InlineAmount } from "./InlineAmount";

const baseConfig: AccountConfig = { displayName: "Cash", currency: "USD" };

describe("InlineAmount", () => {
    it("shows the formatted amount and currency", async () => {
        renderWithI18n(
            <InlineAmount accountKey="cash" config={{ ...baseConfig, amount: 1234 }} onSave={vi.fn()} />,
        );

        await expect.element(page.getByText("USD")).toBeVisible();
        await expect.element(page.getByText("1,234")).toBeVisible();
    });

    it("renders the 'Set balance' prompt (i18n macro) when no amount is set", async () => {
        renderWithI18n(
            <InlineAmount accountKey="cash" config={baseConfig} onSave={vi.fn()} />,
        );

        // Proves the lingui macro renders its source text via the test provider.
        await expect.element(page.getByText("Set balance")).toBeVisible();
    });

    it("enters edit mode and commits a changed amount on blur", async () => {
        const onSave = vi.fn().mockResolvedValue(undefined);
        renderWithI18n(
            <InlineAmount accountKey="cash" config={{ ...baseConfig, amount: 100 }} onSave={onSave} />,
        );

        await page.getByRole("button").click();
        const input = page.getByLabelText("Account balance");
        await input.fill("250");
        // Blur by clicking elsewhere triggers commit.
        await input.element().blur();

        await vi.waitFor(() => {
            expect(onSave).toHaveBeenCalledWith("cash", expect.objectContaining({ amount: 250 }));
        });
    });

    it("commits on Enter", async () => {
        const onSave = vi.fn().mockResolvedValue(undefined);
        renderWithI18n(
            <InlineAmount accountKey="cash" config={{ ...baseConfig, amount: 100 }} onSave={onSave} />,
        );

        await page.getByRole("button").click();
        const input = page.getByLabelText("Account balance");
        await input.fill("300");
        await input.element().dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

        await vi.waitFor(() => {
            expect(onSave).toHaveBeenCalledWith("cash", expect.objectContaining({ amount: 300 }));
        });
    });

    it("cancels on Escape without saving", async () => {
        const onSave = vi.fn().mockResolvedValue(undefined);
        renderWithI18n(
            <InlineAmount accountKey="cash" config={{ ...baseConfig, amount: 100 }} onSave={onSave} />,
        );

        await page.getByRole("button").click();
        const input = page.getByLabelText("Account balance");
        await input.fill("999");
        await input.element().dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

        await expect.element(page.getByText("100")).toBeVisible();
        expect(onSave).not.toHaveBeenCalled();
    });

    it("does not save when the value is unchanged", async () => {
        const onSave = vi.fn().mockResolvedValue(undefined);
        renderWithI18n(
            <InlineAmount accountKey="cash" config={{ ...baseConfig, amount: 100 }} onSave={onSave} />,
        );

        await page.getByRole("button").click();
        const input = page.getByLabelText("Account balance");
        await input.element().blur();

        await expect.element(page.getByText("100")).toBeVisible();
        expect(onSave).not.toHaveBeenCalled();
    });
});
