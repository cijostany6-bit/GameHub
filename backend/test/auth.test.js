"use strict";

/* =========================================================
   Cognito JWT verification tests.
   ---------------------------------------------------------
   A real RSA keypair signs real RS256 tokens; a throwaway
   HTTP server serves the JWKS. Nothing is mocked except the
   pool's endpoint — the signature math, issuer/audience/exp
   checks and the middleware are the production code paths.

   Covers: open probes, 401 without/with bad tokens, valid
   token → identity, expired/wrong-key/wrong-audience/wrong-
   issuer/wrong-token-use rejections, JWKS caching, and the
   unconfigured (local dev) passthrough.
   ========================================================= */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const http = require("node:http");

const POOL_ID = "eu-central-1_TESTPOOL";
const CLIENT_ID = "testclientid123";
const REGION = "eu-central-1";
const ISSUER = `https://cognito-idp.${REGION}.amazonaws.com/${POOL_ID}`;

// --- key material -----------------------------------------------------
const primary = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const rogue = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });

const PRIMARY_KID = "primary-key-1";
const PRIMARY_JWK = {
    ...primary.publicKey.export({ format: "jwk" }),
    kid: PRIMARY_KID,
    use: "sig",
    alg: "RS256"
};

let jwksHits = 0;
let jwksServer;

function sign(payload, { key = primary.privateKey, kid = PRIMARY_KID } = {}) {
    const header = { alg: "RS256", kid, typ: "JWT" };
    const enc = (obj) =>
        Buffer.from(JSON.stringify(obj)).toString("base64url");
    const data = `${enc(header)}.${enc(payload)}`;
    const signature = crypto
        .sign("RSA-SHA256", Buffer.from(data), key)
        .toString("base64url");
    return `${data}.${signature}`;
}

function validClaims(overrides = {}) {
    return {
        sub: "user-123",
        email: "player@example.com",
        "cognito:username": "player",
        iss: ISSUER,
        aud: CLIENT_ID,
        token_use: "id",
        exp: Math.floor(Date.now() / 1000) + 3600,
        ...overrides
    };
}

// --- environment + app ------------------------------------------------
process.env.COGNITO_REGION = REGION;
process.env.COGNITO_USER_POOL_ID = POOL_ID;
process.env.COGNITO_CLIENT_ID = CLIENT_ID;

const app = require("../app");

let server;
let base;

before(async () => {
    // JWKS endpoint with hit counting (proves the cache works).
    jwksServer = http.createServer((req, res) => {
        jwksHits++;
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ keys: [PRIMARY_JWK] }));
    });
    await new Promise((resolve) =>
        jwksServer.listen(0, "127.0.0.1", resolve)
    );
    process.env.COGNITO_JWKS_URI =
        `http://127.0.0.1:${jwksServer.address().port}/jwks`;

    server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    server.closeAllConnections?.();
    server.close();
    await new Promise((resolve) => jwksServer.close(resolve));
    const { pool } = require("../db");
    await pool.end();
});

function get(pathname, token) {
    return fetch(`${base}${pathname}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
}

describe("auth gate", () => {
    it("keeps liveness and readiness open (probes must never 401)", async () => {
        assert.equal((await get("/api/health")).status, 200);
        // readiness may be 200 (DB up) — the point is: NOT 401
        assert.notEqual((await get("/api/ready")).status, 401);
    });

    it("401s a protected route without a token", async () => {
        const res = await get("/api/me");
        assert.equal(res.status, 401);
        assert.deepEqual(await res.json(), { error: "Unauthorized" });
    });

    it("accepts a valid ID token and returns the identity", async () => {
        const res = await get("/api/me", sign(validClaims()));
        assert.equal(res.status, 200);

        const body = await res.json();
        assert.equal(body.sub, "user-123");
        assert.equal(body.email, "player@example.com");
        assert.equal(body.username, "player");
    });

    it("accepts client_id instead of aud (Cognito access tokens differ)", async () => {
        const claims = validClaims({ aud: undefined, client_id: CLIENT_ID });
        assert.equal((await get("/api/me", sign(claims))).status, 200);
    });

    it("401s an expired token", async () => {
        const claims = validClaims({
            exp: Math.floor(Date.now() / 1000) - 60
        });
        assert.equal((await get("/api/me", sign(claims))).status, 401);
    });

    it("401s a token signed by the wrong key (forged signature)", async () => {
        const token = sign(validClaims(), { key: rogue.privateKey });
        assert.equal((await get("/api/me", token)).status, 401);
    });

    it("401s a token for a different audience", async () => {
        const claims = validClaims({ aud: "someone-elses-client" });
        assert.equal((await get("/api/me", sign(claims))).status, 401);
    });

    it("401s a token from a different issuer", async () => {
        const claims = validClaims({
            iss: "https://cognito-idp.eu-central-1.amazonaws.com/OTHER_POOL"
        });
        assert.equal((await get("/api/me", sign(claims))).status, 401);
    });

    it("401s an access token (token_use != id)", async () => {
        const claims = validClaims({ token_use: "access" });
        assert.equal((await get("/api/me", sign(claims))).status, 401);
    });

    it("401s malformed and non-Bearer authorization headers", async () => {
        assert.equal((await get("/api/me", "not.a.jwt")).status, 401);
        assert.equal((await get("/api/me", "a.b")).status, 401);

        const basic = await fetch(`${base}/api/me`, {
            headers: { Authorization: "Basic dXNlcjpwYXNz" }
        });
        assert.equal(basic.status, 401);
    });

    it("caches the JWKS across requests (no refetch per call)", async () => {
        const before = jwksHits;
        await get("/api/me", sign(validClaims()));
        await get("/api/me", sign(validClaims()));
        assert.equal(jwksHits, before, "JWKS must be cached, not refetched");
    });
});

describe("auth disabled (local development)", () => {
    it("passes requests through and /api/me explains itself", async () => {
        const saved = {
            region: process.env.COGNITO_REGION,
            pool: process.env.COGNITO_USER_POOL_ID,
            client: process.env.COGNITO_CLIENT_ID
        };
        delete process.env.COGNITO_REGION;
        delete process.env.COGNITO_USER_POOL_ID;
        delete process.env.COGNITO_CLIENT_ID;

        try {
            // No token, unconfigured pool: routes are reachable...
            const health = await get("/api/health");
            assert.equal(health.status, 200);

            // ...but identity still honestly refuses.
            const me = await get("/api/me");
            assert.equal(me.status, 401);
            assert.deepEqual(await me.json(), {
                error: "Authentication is not configured"
            });
        } finally {
            process.env.COGNITO_REGION = saved.region;
            process.env.COGNITO_USER_POOL_ID = saved.pool;
            process.env.COGNITO_CLIENT_ID = saved.client;
        }
    });
});
