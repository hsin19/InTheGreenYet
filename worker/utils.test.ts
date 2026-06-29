import {
    describe,
    expect,
    it,
} from "vitest";
import {
    ClientError,
    corsHeaders,
    DataSourceNotFoundError,
    errorResponse,
    getToken,
    jsonResponse,
} from "./utils";

describe("Backend Utils", () => {
    describe("corsHeaders", () => {
        it("should return correct CORS headers for a given origin", () => {
            const headers = corsHeaders("https://inthegreenyet.pages.dev");
            expect(headers).toEqual({
                "Access-Control-Allow-Origin": "https://inthegreenyet.pages.dev",
                "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization",
            });
        });
    });

    describe("jsonResponse", () => {
        it("should format Response with correct JSON, status and CORS headers", async () => {
            const data = { hello: "world" };
            const response = jsonResponse(data, 201, "https://example.com");

            expect(response.status).toBe(201);
            expect(response.headers.get("Content-Type")).toBe("application/json");
            expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://example.com");
            expect(await response.json()).toEqual(data);
        });
    });

    describe("errorResponse", () => {
        it("should return 404 for DataSourceNotFoundError", async () => {
            const err = new DataSourceNotFoundError("Transfer");
            const response = errorResponse(err, "https://example.com");

            expect(response.status).toBe(404);
            expect(await response.json()).toEqual({ error: "data_source_not_found" });
        });

        it("should return 400 for ClientError", async () => {
            const err = new ClientError("Invalid input parameters");
            const response = errorResponse(err, "https://example.com");

            expect(response.status).toBe(400);
            expect(await response.json()).toEqual({ error: "Invalid input parameters" });
        });

        it("should return 500 for generic Error", async () => {
            const err = new Error("Something went wrong internally");
            const response = errorResponse(err, "https://example.com");

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
