import {
    describe,
    expect,
    it,
    vi,
} from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { CopyableValue } from "./CopyableValue";

describe("CopyableValue", () => {
    it("renders the value text", async () => {
        render(<CopyableValue value="api-key-123" />);

        await expect.element(page.getByText("api-key-123")).toBeVisible();
    });

    it("exposes a labelled copy button", async () => {
        render(<CopyableValue value="secret-xyz" />);

        await expect.element(page.getByRole("button", { name: "Copy secret-xyz" })).toBeVisible();
    });

    it("writes the value to the clipboard when the copy button is clicked", async () => {
        const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
        render(<CopyableValue value="paste-me" />);

        await page.getByRole("button", { name: "Copy paste-me" }).click();

        expect(writeText).toHaveBeenCalledWith("paste-me");
        vi.restoreAllMocks();
    });
});
