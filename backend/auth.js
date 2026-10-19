"use strict";

/* =========================================================
   Cognito ID-token verification — dependency-free.
   ---------------------------------------------------------
   Verifies RS256 JWTs against the user pool's JWKS using
   node:crypto (createPublicKey supports JWK natively), so no
   jsonwebtoken/jwks-rsa/aws-sdk is needed in the API.

   Authentication is ENFORCED ONLY when the pool is configured
   (COGNITO_REGION + COGNITO_USER_POOL_ID + COGNITO_CLIENT_ID).
   Unconfigured = local development: requests pass through and
   the boot log says so loudly — never a silent fail-open.

   Checks performed (all required by AWS's own docs):
   - alg is RS256, kid resolves in the pool JWKS
   - signature verifies against the matching public key
   - iss === https://cognito-idp.<region>.amazonaws.com/<poolId>
   - audience (aud or client_id) === the app client id
   - exp is in the future, token_use is "id" when present
   ========================================================= */

const crypto = require("node:crypto");

const JWKS_TTL_MS = 6 * 60 * 60 * 1000; // rotate friendly, not chatty
let jwksCache = null; // { at, keys }

function settings() {
    return {
        region: process.env.COGNITO_REGION,
        poolId: process.env.COGNITO_USER_POOL_ID,
        clientId: process.env.COGNITO_CLIENT_ID,
        jwksUri: process.env.COGNITO_JWKS_URI // tests / local override
    };
}

function authEnabled() {
    const config = settings();
    return Boolean(config.region && config.poolId && config.clientId);
}

function issuer() {
    const config = settings();
    return `https://cognito-idp.${config.region}.amazonaws.com/${config.poolId}`;
}

function jwksUri() {
    const config = settings();
    return config.jwksUri || `${issuer()}/.well-known/jwks.json`;
}

function fromBase64Url(value) {
    return Buffer.from(value, "base64url");
}

async function fetchJwks() {
    if (jwksCache && Date.now() - jwksCache.at < JWKS_TTL_MS) {
        return jwksCache.keys;
    }
    const response = await fetch(jwksUri());
    if (!response.ok) {
        throw new Error("jwks_fetch_failed");
    }
    const body = await response.json();
    jwksCache = { at: Date.now(), keys: Array.isArray(body.keys) ? body.keys : [] };
    return jwksCache.keys;
}

async function verifyIdToken(token) {
    const parts = String(token || "").split(".");
    if (parts.length !== 3) {
        throw new Error("malformed_token");
    }

    let header;
    let payload;
    try {
        header = JSON.parse(fromBase64Url(parts[0]).toString("utf8"));
        payload = JSON.parse(fromBase64Url(parts[1]).toString("utf8"));
    } catch (error) {
        throw new Error("malformed_token", { cause: error });
    }

    if (header.alg !== "RS256" || !header.kid) {
        throw new Error("unsupported_token");
    }

    const keys = await fetchJwks();
    const jwk = keys.find((key) => key.kid === header.kid);
    if (!jwk) {
        throw new Error("unknown_key");
    }

    const publicKey = crypto.createPublicKey({ key: jwk, format: "jwk" });
    const signatureValid = crypto.verify(
        "RSA-SHA256",
        Buffer.from(`${parts[0]}.${parts[1]}`),
        publicKey,
        fromBase64Url(parts[2])
    );
    if (!signatureValid) {
        throw new Error("bad_signature");
    }

    const config = settings();
    if (payload.iss !== issuer()) {
        throw new Error("bad_issuer");
    }
    const audience = payload.aud || payload.client_id;
    if (audience !== config.clientId) {
        throw new Error("bad_audience");
    }
    if (typeof payload.exp !== "number" || payload.exp * 1000 <= Date.now()) {
        throw new Error("expired_token");
    }
    if (payload.token_use && payload.token_use !== "id") {
        throw new Error("wrong_token_use");
    }

    return payload;
}

// Express middleware: no-op while unconfigured, hard 401 otherwise.
function requireAuth(req, res, next) {
    if (!authEnabled()) {
        next();
        return;
    }

    const header = req.headers.authorization || "";
    const [scheme, token] = header.split(" ");
    if (scheme !== "Bearer" || !token) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }

    verifyIdToken(token)
        .then((payload) => {
            req.user = {
                sub: payload.sub,
                email: payload.email || null,
                username: payload["cognito:username"] || null
            };
            next();
        })
        .catch((error) => {
            console.warn(JSON.stringify({
                ts: new Date().toISOString(),
                level: "warn",
                msg: "auth_rejected",
                reason: error.message,
                path: req.originalUrl
            }));
            res.status(401).json({ error: "Unauthorized" });
        });
}

module.exports = {
    requireAuth,
    authEnabled,
    verifyIdToken,
    _resetCache: () => {
        jwksCache = null;
    }
};
