import {
    describe,
    expect,
    it,
} from "vitest";
import {
    ClientError,
    DataSourceNotFoundError,
    errorResponse,
    getToken,
    jsonResponse,
} from "./utils";

describe("Backend Utils", () => {
    describe("jsonResponse", () => {
        it("should format Response with correct JSON and status", async () => {
            const data = { hello: "world" };
            const response = jsonResponse(data, 201);

            expect(response.status).toBe(201);
            expect(response.headers.get("Content-Type")).toBe("application/json");
            expect(await response.json()).toEqual(data);
        });
    });

    describe("errorResponse", () => {
        it("should return 404 for DataSourceNotFoundError", async () => {
            const response = errorResponse(new DataSourceNotFoundError("Transfer"));

            expect(response.status).toBe(404);
            expect(await response.json()).toEqual({ error: "data_source_not_found" });
        });

        it("should return 400 for ClientError", async () => {
            const response = errorResponse(new ClientError("Invalid input parameters"));

            expect(response.status).toBe(400);
            expect(await response.json()).toEqual({ error: "Invalid input parameters" });
        });

        it("should return 500 for generic Error", async () => {
            const response = errorResponse(new Error("Something went wrong internally"));

            expect(response.status).toBe(500);
            expect(await response.json()).toEqual({ error: "Something went wrong internally" });
        });
    });

    describe("getToken", () => {
        it("should extract token from Bearer auth header", () => {
            const request = new Request("http://localhost", {
                headers: {
                    Authorization: "Bearer my-secret-notion-token",
                },
            });
            const token = getToken(request);
            expect(token).toBe("my-secret-notion-token");
        });

        it("should throw ClientError if Authorization header is missing", () => {
            const request = new Request("http://localhost");
            expect(() => getToken(request)).toThrow(ClientError);
            expect(() => getToken(request)).toThrow("Missing Authorization header");
        });

        it("should throw ClientError if Authorization header does not start with Bearer", () => {
            const request = new Request("http://localhost", {
                headers: {
                    Authorization: "Token my-secret-notion-token",
                },
            });
            expect(() => getToken(request)).toThrow(ClientError);
        });
    });
});
