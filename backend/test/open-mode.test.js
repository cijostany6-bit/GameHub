"use strict";

/* =========================================================
   Open mode — the deployment with no Cognito pool.
   ---------------------------------------------------------
   Local development runs this way on purpose (see
   backend/auth.js): the catalogue and the games work, and the
   signed-in features answer 501 rather than pretending.

   This file must NOT set COGNITO_* — `node --test` gives each
   file its own process, which is what makes an unconfigured
   pool testable at all. The assertions here are the contract
   for every fresh clone and every `make up`.
   ========================================================= */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");

process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "gamehub";
process.env.DB_PASSWORD ||= "gamehub_local_pw";
process.env.DB_NAME ||= "gamehub";

// Belt and braces: if the surrounding shell exported a pool, unset it —
// this suite is about the deployment where there is none.
delete process.env.COGNITO_USER_POOL_ID;
delete process.env.COGNITO_CLIENT_ID;
delete process.env.COGNITO_REGION;

const app = require("../app");

let server;
let base;
let dbAvailable = false;

before(async () => {
    if (process.env.COGNITO_USER_POOL_ID) {
        throw new Error("open-mode suite requires an unset user pool");
    }
    // The 501 answers below never touch the database, but /api/games does.
    try {
        const { ping } = require("../db");
        await Promise.race([
            ping(),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error("probe timeout")), 3000)
            )
        ]);
        dbAvailable = true;
    } catch {
        dbAvailable = false;
    }

    server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    server.closeAllConnections?.();
    server.close();
    const { pool } = require("../db");
    await pool.end();
});

async function get(path) {
    const response = await fetch(`${base}${path}`);
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null };
}

describe("open mode (no pool configured)", () => {
    it("keeps the read-only API usable", async (t) => {
        assert.equal((await get("/api/health")).status, 200);
        if (!dbAvailable) {
            t.skip("MySQL not reachable — catalogue check skipped");
            return;
        }
        assert.equal((await get("/api/games")).status, 200);
    });

    it("401s the identity echo instead of inventing a user", async () => {
        assert.equal((await get("/api/me")).status, 401);
    });

    it("answers 501 for the signed-in features, never 200 with fake data", async () => {
        const scores = await get("/api/scores/me");
        assert.equal(scores.status, 501);
        assert.match(scores.body.error, /Cognito gate/);

        const post = await fetch(`${base}/api/scores`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ game: "Cyber Strike", score: 10 })
        });
        assert.equal(post.status, 501);

        const del = await fetch(`${base}/api/me`, { method: "DELETE" });
        assert.equal(del.status, 501);
    });
});
