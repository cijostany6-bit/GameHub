"use strict";

/* =========================================================
   GDPR / signed-in features tests (Phase 7).
   ---------------------------------------------------------
   Real RSA keypair, real JWKS server, real MySQL, and a real
   HTTP endpoint standing in for Cognito's admin API — so the
   production code paths run end to end:

     · the JWT gate (backend/auth.js)
     · the SQL, including row isolation between players
     · the SigV4 signer (backend/cognito.js) against an
       endpoint that inspects the Authorization header
     · the deletion ordering and its failure mode

   The suite is SKIPPED loudly (not failed) when MySQL is
   unreachable, matching the other integration tests.
   ========================================================= */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const http = require("node:http");

const POOL_ID = "eu-central-1_GDPRTEST";
const CLIENT_ID = "gdprtestclient";
const REGION = "eu-central-1";
const ISSUER = `https://cognito-idp.${REGION}.amazonaws.com/${POOL_ID}`;

const primary = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const KID = "gdpr-key-1";
const JWK = {
    ...primary.publicKey.export({ format: "jwk" }),
    kid: KID,
    use: "sig",
    alg: "RS256"
};

const ALICE = "sub-alice-0001";
const BOB = "sub-bob-0002";

function sign(payload) {
    const header = { alg: "RS256", kid: KID, typ: "JWT" };
    const enc = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
    const data = `${enc(header)}.${enc(payload)}`;
    const signature = crypto
        .sign("RSA-SHA256", Buffer.from(data), primary.privateKey)
        .toString("base64url");
    return `${data}.${signature}`;
}

function claims(sub, email, overrides = {}) {
    return {
        sub,
        email,
        "cognito:username": email,
        iss: ISSUER,
        aud: CLIENT_ID,
        token_use: "id",
        exp: Math.floor(Date.now() / 1000) + 3600,
        ...overrides
    };
}

process.env.COGNITO_REGION = REGION;
process.env.COGNITO_USER_POOL_ID = POOL_ID;
process.env.COGNITO_CLIENT_ID = CLIENT_ID;
// Credentials present ⇒ the signer never touches 169.254.169.254.
process.env.AWS_ACCESS_KEY_ID = "AKIAEXAMPLEFORTEST";
process.env.AWS_SECRET_ACCESS_KEY = "test-secret-key-not-a-real-one";

// Same defaults as docker-compose.yml, for the host-run suite.
process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "gamehub";
process.env.DB_PASSWORD ||= "gamehub_local_pw";
process.env.DB_NAME ||= "gamehub";

const app = require("../app");

let server;
let base;
let jwksServer;
let cognitoServer;
let dbAvailable = false;

// What the fake Cognito saw.
const cognitoCalls = [];
let cognitoBehaviour = "ok"; // "ok" | "not_found"

function needsDb(t) {
    if (!dbAvailable) {
        t.skip("MySQL not reachable — suite skipped");
        return true;
    }
    return false;
}

async function request(method, path, { token, body } = {}) {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body) headers["Content-Type"] = "application/json";
    const response = await fetch(`${base}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
    });
    const text = await response.text();
    return {
        status: response.status,
        body: text ? JSON.parse(text) : null
    };
}

before(async () => {
    // --- JWKS -----------------------------------------------------------
    jwksServer = http.createServer((req, res) => {
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ keys: [JWK] }));
    });
    await new Promise((resolve) => jwksServer.listen(0, "127.0.0.1", resolve));
    process.env.COGNITO_JWKS_URI =
        `http://127.0.0.1:${jwksServer.address().port}/jwks`;

    // --- fake Cognito admin endpoint -----------------------------------
    cognitoServer = http.createServer((req, res) => {
        let raw = "";
        req.on("data", (chunk) => { raw += chunk; });
        req.on("end", () => {
            cognitoCalls.push({
                authorization: req.headers.authorization,
                target: req.headers["x-amz-target"],
                date: req.headers["x-amz-date"],
                body: raw ? JSON.parse(raw) : null
            });
            if (cognitoBehaviour === "not_found") {
                res.statusCode = 400;
                res.end(JSON.stringify({ __type: "UserNotFoundException" }));
                return;
            }
            res.setHeader("content-type", "application/json");
            res.end("{}");
        });
    });
    await new Promise((resolve) => cognitoServer.listen(0, "127.0.0.1", resolve));
    process.env.COGNITO_ENDPOINT =
        `http://127.0.0.1:${cognitoServer.address().port}`;

    // --- database -------------------------------------------------------
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
            "GDPR suite will be SKIPPED. Start the stack with `make up`."
        );
    }

    server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    if (dbAvailable) {
        const { pool } = require("../db");
        await pool.query(
            "DELETE FROM personal_bests WHERE user_sub IN (?, ?)",
            [ALICE, BOB]
        );
        await pool.end();
    }
    server.closeAllConnections?.();
    server.close();
    await new Promise((resolve) => jwksServer.close(resolve));
    await new Promise((resolve) => cognitoServer.close(resolve));
});

describe("personal bests — access control", () => {
    it("401s without a token", async (t) => {
        if (needsDb(t)) return;
        assert.equal((await request("POST", "/api/scores", {
            body: { game: "Cyber Strike", score: 10 }
        })).status, 401);
        assert.equal((await request("GET", "/api/scores/me")).status, 401);
        assert.equal((await request("DELETE", "/api/me")).status, 401);
    });

    it("rejects an unknown game (no free-text rows about a user)", async (t) => {
        if (needsDb(t)) return;
        const res = await request("POST", "/api/scores", {
            token: sign(claims(ALICE, "alice@example.com")),
            body: { game: "Not A Game", score: 5 }
        });
        assert.equal(res.status, 400);
        assert.equal(res.body.error, "Unknown game");
    });

    it("rejects a score that is not a sane integer", async (t) => {
        if (needsDb(t)) return;
        const token = sign(claims(ALICE, "alice@example.com"));
        for (const score of [1.5, -1, 1e12, "many", null]) {
            const res = await request("POST", "/api/scores", {
                token,
                body: { game: "Cyber Strike", score }
            });
            assert.equal(res.status, 400, `score=${score} should be rejected`);
        }
    });
});

describe("personal bests — storage", () => {
    it("stores only the player's best score per game", async (t) => {
        if (needsDb(t)) return;
        const token = sign(claims(ALICE, "alice@example.com"));

        const first = await request("POST", "/api/scores", {
            token, body: { game: "Cyber Strike", score: 1200 }
        });
        assert.equal(first.status, 201);
        assert.equal(first.body.best, 1200);

        // A worse score must not replace the best…
        const worse = await request("POST", "/api/scores", {
            token, body: { game: "Cyber Strike", score: 300 }
        });
        assert.equal(worse.body.best, 1200);

        // …and a better one must.
        const better = await request("POST", "/api/scores", {
            token, body: { game: "Cyber Strike", score: 9999 }
        });
        assert.equal(better.body.best, 9999);

        // One row, not three: the table cannot grow with play count.
        const { pool } = require("../db");
        const [rows] = await pool.query(
            "SELECT COUNT(*) AS n FROM personal_bests WHERE user_sub = ?",
            [ALICE]
        );
        assert.equal(rows[0].n, 1);
    });

    it("returns one player's scores and nobody else's", async (t) => {
        if (needsDb(t)) return;
        await request("POST", "/api/scores", {
            token: sign(claims(BOB, "bob@example.com")),
            body: { game: "Neon Rivals", score: 777 }
        });

        const alice = await request("GET", "/api/scores/me", {
            token: sign(claims(ALICE, "alice@example.com"))
        });
        assert.equal(alice.status, 200);
        const games = alice.body.scores.map((row) => row.game);
        assert.ok(games.includes("Cyber Strike"));
        assert.ok(!games.includes("Neon Rivals"),
            "Alice must not see Bob's scores");

        const bob = await request("GET", "/api/scores/me", {
            token: sign(claims(BOB, "bob@example.com"))
        });
        assert.deepEqual(bob.body.scores.map((row) => row.game), ["Neon Rivals"]);
        // No identifiers are echoed back — sub and email stay server-side.
        assert.ok(!JSON.stringify(alice.body).includes("alice@example.com"));
        assert.ok(!JSON.stringify(alice.body).includes(ALICE));
    });
});

describe("account deletion — GDPR art. 17", () => {
    before(async () => {
        if (!dbAvailable) return;
        await request("POST", "/api/scores", {
            token: sign(claims(ALICE, "alice@example.com")),
            body: { game: "Cyber Strike", score: 4242 }
        });
    });

    it("signs the Cognito call with SigV4 and deletes both datasets", async (t) => {
        if (needsDb(t)) return;
        cognitoCalls.length = 0;

        const res = await request("DELETE", "/api/me", {
            token: sign(claims(ALICE, "alice@example.com"))
        });
        assert.equal(res.status, 204);

        // --- the identity call ------------------------------------------
        assert.equal(cognitoCalls.length, 1);
        const call = cognitoCalls[0];
        assert.equal(
            call.target,
            "AWSCognitoIdentityProviderService.AdminDeleteUser"
        );
        assert.match(
            call.authorization,
            /^AWS4-HMAC-SHA256 Credential=AKIAEXAMPLEFORTEST\/\d{8}\/eu-central-1\/cognito-idp\/aws4_request, SignedHeaders=[a-z0-9;-]+, Signature=[0-9a-f]{64}$/
        );
        assert.match(call.date, /^\d{8}T\d{6}Z$/);
        assert.deepEqual(call.body, {
            UserPoolId: POOL_ID,
            Username: "alice@example.com"
        });

        // --- the rows ---------------------------------------------------
        const { pool } = require("../db");
        const [aliceRows] = await pool.query(
            "SELECT COUNT(*) AS n FROM personal_bests WHERE user_sub = ?",
            [ALICE]
        );
        assert.equal(aliceRows[0].n, 0, "Alice's rows must be gone");

        // Bob is untouched — deleting one player is not a table wipe.
        const [bobRows] = await pool.query(
            "SELECT COUNT(*) AS n FROM personal_bests WHERE user_sub = ?",
            [BOB]
        );
        assert.ok(bobRows[0].n >= 1);
    });

    it("still erases the data when the identity call fails, and says so", async (t) => {
        if (needsDb(t)) return;
        await request("POST", "/api/scores", {
            token: sign(claims(ALICE, "alice@example.com")),
            body: { game: "Apex Circuit", score: 55 }
        });

        cognitoBehaviour = "not_found";
        try {
            const res = await request("DELETE", "/api/me", {
                token: sign(claims(ALICE, "alice@example.com"))
            });
            assert.equal(res.status, 502);
            assert.match(res.body.error, /game data was deleted/i);
        } finally {
            cognitoBehaviour = "ok";
        }

        const { pool } = require("../db");
        const [rows] = await pool.query(
            "SELECT COUNT(*) AS n FROM personal_bests WHERE user_sub = ?",
            [ALICE]
        );
        assert.equal(rows[0].n, 0);
    });
});
