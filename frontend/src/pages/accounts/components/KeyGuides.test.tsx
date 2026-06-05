import { renderWithI18n } from "@/test/render";
import {
    describe,
    expect,
    it,
} from "vitest";
import { page } from "vitest/browser";
import { BinanceKeyGuide } from "./BinanceKeyGuide";
import { BitgetKeyGuide } from "./BitgetKeyGuide";
import { MaxKeyGuide } from "./MaxKeyGuide";

const GUIDES = [
    { name: "Binance", Guide: BinanceKeyGuide, title: "Get your Binance API key" },
    { name: "Bitget", Guide: BitgetKeyGuide, title: "Get your Bitget API key" },
    { name: "MAX", Guide: MaxKeyGuide, title: "Get your MAX API key" },
] as const;

describe.each(GUIDES)("$name key guide", ({ Guide, title }) => {
    it("opens the step-by-step dialog from the trigger link", async () => {
        renderWithI18n(<Guide />);

        const trigger = page.getByText("How do I get these?");
        await expect.element(trigger).toBeVisible();
        await trigger.click();

        // The numbered steps only render once the dialog opens, so this exercises
        // the STEPS map and the dialog body.
        await expect.element(page.getByText(title)).toBeVisible();
        await expect.element(
            page.getByText("InTheGreenYet only reads your balances", { exact: false }),
        ).toBeVisible();
    });
});
