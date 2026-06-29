import {
    describe,
    expect,
    it,
    vi,
} from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { Button } from "./button";

describe("Button", () => {
    it("renders its label", async () => {
        render(<Button>Save</Button>);

        await expect.element(page.getByRole("button", { name: "Save" })).toBeVisible();
    });

    it("fires onClick on a real browser click", async () => {
        const onClick = vi.fn();
        render(<Button onClick={onClick}>Press</Button>);

        await page.getByRole("button", { name: "Press" }).click();

        expect(onClick).toHaveBeenCalledOnce();
    });
});
