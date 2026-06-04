import {
    describe,
    expect,
    it,
} from "vitest";
import { cn } from "./utils";

describe("cn", () => {
    it("joins truthy class values and drops falsy ones", () => {
        expect(cn("a", false, null, undefined, "b")).toBe("a b");
    });

    it("lets later tailwind utilities win over conflicting earlier ones", () => {
        expect(cn("p-2", "p-4")).toBe("p-4");
        expect(cn("text-sm text-red-500", "text-lg")).toBe("text-red-500 text-lg");
    });
});
