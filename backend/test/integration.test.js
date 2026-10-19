"use strict";

// =========================================================
// Integration tests — require a REAL MySQL (local compose
// publishes it on 127.0.0.1:3306; CI provides a service
// container). If the database is unreachable the suite is
// SKIPPED loudly instead of failing — a fresh clone with
// no Docker running still gets green unit tests.
// =========================================================

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");

// Defaults matching docker-compose.yml (env vars win if set).
process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "gamehub";
process.env.DB_PASSWORD ||= "gamehub_local_pw";
process.env.DB_NAME ||= "gamehub";

const app = require("../app");

const VALID_CATEGORIES = new Set(["Action", "Racing", "Strategy"]);

let server;
let base;
let dbAvailable = false;

function needsDb(t) {
    if (!dbAvailable) {
        t.skip("MySQL not reachable — integration suite skipped");
        return true;
    }
    return false;
}

before(async () => {
    // Probe the database with a short timeout.
    try {
        const { ping } = require("../db");
        await Promise.race([
            ping(),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error("probe timeout")), 3000)
            )
        ]);
        dbAvailable = true;
    } catch (error) {
        console.warn(
            `  ! MySQL unreachable (${error.code || error.message}) — ` +
            "integration tests will be SKIPPED. Start the stack with `make up`."
        );
    }

    server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    server.closeAllConnections?.();
    server.close();
    const { pool } = require("../db");
    await pool.end(); // release handles or the process never exits
});

describe("readiness /api/ready", () => {
    it("reports database up", async (t) => {
        if (needsDb(t)) return;

        const res = await fetch(`${base}/api/ready`);
        assert.equal(res.status, 200);

        const body = await res.json();
        assert.equal(body.status, "ready");
        assert.equal(body.database, "up");
    });
});

describe("GET /api/games", () => {
    it("returns the seeded catalogue as a JSON array", async (t) => {
        if (needsDb(t)) return;

        const res = await fetch(`${base}/api/games`);
        assert.equal(res.status, 200);
        assert.match(res.headers.get("content-type"), /application\/json/);

        const games = await res.json();
        assert.ok(Array.isArray(games));
        assert.ok(games.length >= 12, `expected ≥12 seeded games, got ${games.length}`);
    });

    it("every row has the exact shape the frontend consumes", async (t) => {
        if (needsDb(t)) return;

        const games = await (await fetch(`${base}/api/games`)).json();

        for (const game of games) {
            assert.equal(typeof game.id, "number", "id must be a number");
            assert.equal(typeof game.name, "string", "name must be a string");
            assert.equal(typeof game.category, "string", "category must be a string");
            assert.equal(typeof game.description, "string", "description must be a string");
            assert.ok(game.name.length > 0, "name must not be empty");
            assert.ok(
                VALID_CATEGORIES.has(game.category),
                `unexpected category "${game.category}" — must match the UI filters`
            );
        }
    });

    it("returns rows ordered by id ascending", async (t) => {
        if (needsDb(t)) return;

        const games = await (await fetch(`${base}/api/games`)).json();
        const ids = games.map((game) => game.id);
        const sorted = [...ids].sort((a, b) => a - b);
        assert.deepEqual(ids, sorted, "catalogue must be stably ordered");
    });

    it("game names are unique (drives image mapping & routing)", async (t) => {
        if (needsDb(t)) return;

        const games = await (await fetch(`${base}/api/games`)).json();
        const names = games.map((game) => game.name);
        assert.equal(names.length, new Set(names).size, "duplicate game names");
    });
});

describe("GET /api/games/:id", () => {
    it("returns exactly one game with the list-compatible shape", async (t) => {
        if (needsDb(t)) return;

        const list = await (await fetch(`${base}/api/games`)).json();
        const target = list[0];

        const res = await fetch(`${base}/api/games/${target.id}`);
        assert.equal(res.status, 200);

        const game = await res.json();
        assert.deepEqual(game, target, "detail must match the list row");
    });

    it("404s for an id that does not exist", async (t) => {
        if (needsDb(t)) return;

        const res = await fetch(`${base}/api/games/999999`);
        assert.equal(res.status, 404);

        const body = await res.json();
        assert.deepEqual(body, { error: "Game not found" });
    });

    it("404s (does not crash) on a non-numeric id", async (t) => {
        if (needsDb(t)) return;

        const res = await fetch(`${base}/api/games/not-a-number`);
        assert.equal(res.status, 404);

        const body = await res.json();
        assert.deepEqual(body, { error: "Game not found" });
    });
});
