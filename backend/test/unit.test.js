"use strict";

// =========================================================
// Unit tests — NO database required.
// Covers: liveness, 404 handling, CORS policy, header
// hardening, and the liveness/readiness split under a DB
// outage (the container must NOT look dead when MySQL is
// down — otherwise orchestrators crash-loop it).
// =========================================================

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");

// Load the app with NO database configured — health must
// still work (that is the whole point of /api/health).
delete process.env.DB_HOST;
delete process.env.DB_PORT;

const app = require("../app");
const db = require("../db");

let server;
let base;
let downRefs = null;

let downAppRef = null;

function loadAppWithDbOnClosedPort() {
    if (downAppRef) return downAppRef;
    // Fresh module instances bound to a closed port.
    process.env.DB_HOST = "127.0.0.1";
    process.env.DB_PORT = "1"; // nothing listens here
    process.env.DB_SSL = "true"; // also covers the TLS config branch in db.js
    delete require.cache[require.resolve("../db")];
    delete require.cache[require.resolve("../app")];
    const downDb = require("../db");
    const downApp = require("../app");
    downRefs = { downDb, downApp };
    downAppRef = downApp;
    return downAppRef;
}

before(async () => {
    server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    // Close keep-alive sockets first, then pools — otherwise
    // open handles keep the test process alive forever.
    server.closeAllConnections?.();
    server.close();
    await db.pool.end();
    if (downRefs) {
        await downRefs.downDb.pool.end();
    }
});

describe("liveness /api/health", () => {
    it("returns 200 without touching the database", async () => {
        const res = await fetch(`${base}/api/health`);
        assert.equal(res.status, 200);

        const body = await res.json();
        assert.equal(body.status, "healthy");
        assert.equal(body.service, "gamehub-backend");
        assert.ok(!Number.isNaN(Date.parse(body.timestamp)));
    });
});

describe("404 handling", () => {
    it("returns a clean JSON 404, not HTML", async () => {
        const res = await fetch(`${base}/api/does-not-exist`);
        assert.equal(res.status, 404);

        const body = await res.json();
        assert.deepEqual(body, { error: "Not found" });
    });
});

describe("header hardening", () => {
    it("does not advertise the Express framework", async () => {
        const res = await fetch(`${base}/api/health`);
        assert.equal(res.headers.get("x-powered-by"), null);
    });

    it("returns JSON content type on API routes", async () => {
        const res = await fetch(`${base}/api/health`);
        assert.match(res.headers.get("content-type"), /application\/json/);
    });
});

describe("CORS policy", () => {
    it("allows the configured origin", async () => {
        const res = await fetch(`${base}/api/health`, {
            headers: { Origin: "http://localhost:8080" }
        });
        assert.equal(
            res.headers.get("access-control-allow-origin"),
            "http://localhost:8080"
        );
    });

    it("refuses unknown origins (no wildcard)", async () => {
        const res = await fetch(`${base}/api/health`, {
            headers: { Origin: "http://evil.example" }
        });
        assert.equal(res.headers.get("access-control-allow-origin"), null);
    });
});

describe("readiness under database outage", () => {
    it("liveness stays 200 while readiness returns 503", async () => {
        const downApp = loadAppWithDbOnClosedPort();
        const downServer = downApp.listen(0, "127.0.0.1");
        await new Promise((resolve) => downServer.once("listening", resolve));
        const downBase = `http://127.0.0.1:${downServer.address().port}`;

        try {
            const live = await fetch(`${downBase}/api/health`);
            assert.equal(live.status, 200, "liveness must not depend on the DB");

            const ready = await fetch(`${downBase}/api/ready`);
            assert.equal(ready.status, 503, "readiness must fail without a DB");

            const body = await ready.json();
            assert.equal(body.status, "not_ready");
            assert.equal(body.database, "down");
        } finally {
            downServer.closeAllConnections?.();
            downServer.close();
        }
    });
});

describe("error handling under database outage", () => {
    it("games returns a generic 500 with no internal details", async () => {
        const downApp = loadAppWithDbOnClosedPort();
        const downServer = downApp.listen(0, "127.0.0.1");
        await new Promise((resolve) => downServer.once("listening", resolve));
        const downBase = `http://127.0.0.1:${downServer.address().port}`;

        try {
            const res = await fetch(`${downBase}/api/games`);
            assert.equal(res.status, 500);

            const body = await res.json();
            assert.deepEqual(body, { error: "Failed to retrieve games" });
            assert.ok(
                !JSON.stringify(body).includes("connect"),
                "driver details must never leak to clients"
            );
        } finally {
            downServer.closeAllConnections?.();
            downServer.close();
        }
    });
});

describe("request body validation", () => {
    it("rejects malformed JSON with 400 (not 500)", async () => {
        const res = await fetch(`${base}/api/anything`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{not json"
        });
        // 404 route-level: JSON middleware runs first and fails → 400.
        assert.equal(res.status, 400);

        const body = await res.json();
        assert.deepEqual(body, { error: "Invalid JSON body" });
    });
});
