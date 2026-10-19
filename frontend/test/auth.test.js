"use strict";

/* =========================================================
   Frontend auth tests (Node, vm sandbox).
   ---------------------------------------------------------
   auth.js is loaded with a stubbed window/localStorage/fetch,
   so the session model, the Cognito REST calls, the API
   Authorization header and the page guard are all asserted
   without a browser or an AWS account.
   ========================================================= */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const SOURCE = fs.readFileSync(
    path.join(__dirname, "..", "auth.js"),
    "utf8"
);

function makeToken(claims) {
    const header = Buffer.from(JSON.stringify({ alg: "RS256", kid: "k" }))
        .toString("base64url");
    const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
    return `${header}.${payload}.signature`;
}

function createEnv(config, { url = "https://hub.example/games.html", search = "" } = {}) {
    const storage = new Map();
    const calls = [];
    const redirects = [];

    const windowStub = {
        GAMEHUB_CONFIG: config,
        localStorage: {
            getItem: (key) => (storage.has(key) ? storage.get(key) : null),
            setItem: (key, value) => storage.set(key, String(value)),
            removeItem: (key) => storage.delete(key)
        },
        location: {
            pathname: url.replace(/^https?:\/\/[^/]+/, ""),
            search,
            href: url,
            replace: (target) => redirects.push(target)
        },
        fetch: async (endpoint, options = {}) => {
            calls.push({ endpoint, options });
            return windowStub.__response;
        },
        addEventListener: () => {},
        __response: {
            ok: true,
            status: 200,
            json: async () => ({})
        }
    };

    const documentStub = {
        readyState: "complete",
        addEventListener: () => {},
        querySelector: () => null
    };

    const sandbox = {
        window: windowStub,
        document: documentStub,
        atob: (value) =>
            Buffer.from(value, "base64").toString("binary"),
        console,
        Date,
        JSON,
        Boolean,
        String,
        Object,
        Math
    };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(SOURCE, sandbox, { filename: "auth.js" });

    return {
        auth: sandbox.window.GameHubAuth,
        apiFetch: sandbox.window.apiFetch,
        window: windowStub,
        calls,
        redirects,
        storage
    };
}

const ENABLED = {
    authEnabled: true,
    region: "eu-central-1",
    userPoolId: "eu-central-1_TEST",
    clientId: "client123",
    apiBase: ""
};

const DISABLED = { authEnabled: false, region: "", userPoolId: "", clientId: "" };

function unexpiredClaims(extra = {}) {
    return {
        sub: "user-1",
        email: "player@example.com",
        exp: Math.floor(Date.now() / 1000) + 3600,
        ...extra
    };
}

describe("auth configuration", () => {
    it("is disabled by default (local development)", () => {
        const env = createEnv(DISABLED);
        assert.equal(env.auth.configured(), false);
        assert.equal(env.auth.isAuthenticated(), false);
    });

    it("is enabled with a full pool configuration", () => {
        const env = createEnv(ENABLED);
        assert.equal(env.auth.configured(), true);
    });

    it("requires every pool field, not just the flag", () => {
        const env = createEnv({ ...ENABLED, clientId: "" });
        assert.equal(env.auth.configured(), false);
    });
});

describe("sign-in session", () => {
    it("stores the ID token and exposes the user", async () => {
        const env = createEnv(ENABLED);
        env.window.__response = {
            ok: true,
            status: 200,
            json: async () => ({
                AuthenticationResult: {
                    IdToken: makeToken(unexpiredClaims()),
                    AccessToken: "access",
                    RefreshToken: "refresh"
                }
            })
        };

        await env.auth.signIn("player@example.com", "password123");

        assert.equal(env.auth.isAuthenticated(), true);
        assert.equal(env.auth.currentUser(), "player@example.com");
        assert.ok(env.auth.idToken);

        // The request went to the regional Cognito endpoint with the
        // USER_PASSWORD_AUTH flow and the right target header.
        const call = env.calls[0];
        assert.equal(call.endpoint, "https://cognito-idp.eu-central-1.amazonaws.com/");
        assert.equal(
            call.options.headers["X-Amz-Target"],
            "AWSCognitoIdentityProviderService.InitiateAuth"
        );
        const body = JSON.parse(call.options.body);
        assert.equal(body.AuthFlow, "USER_PASSWORD_AUTH");
        assert.equal(body.AuthParameters.USERNAME, "player@example.com");
    });

    it("treats an expired token as signed out", async () => {
        const env = createEnv(ENABLED);
        env.window.__response = {
            ok: true,
            status: 200,
            json: async () => ({
                AuthenticationResult: {
                    IdToken: makeToken(unexpiredClaims({
                        exp: Math.floor(Date.now() / 1000) - 10
                    }))
                }
            })
        };

        await env.auth.signIn("player@example.com", "password123");
        assert.equal(env.auth.isAuthenticated(), false);
    });

    it("surfaces Cognito errors without the internal type prefix", async () => {
        const env = createEnv(ENABLED);
        env.window.__response = {
            ok: false,
            status: 400,
            json: async () => ({
                __type: "NotAuthorizedException",
                message: "NotAuthorizedException: Incorrect username or password."
            })
        };

        await assert.rejects(
            () => env.auth.signIn("player@example.com", "wrong"),
            /Incorrect username or password/
        );
    });

    it("signOut clears the session", async () => {
        const env = createEnv(ENABLED);
        env.window.__response = {
            ok: true,
            status: 200,
            json: async () => ({
                AuthenticationResult: { IdToken: makeToken(unexpiredClaims()) }
            })
        };

        await env.auth.signIn("player@example.com", "password123");
        env.auth.signOut();

        assert.equal(env.auth.isAuthenticated(), false);
        assert.equal(env.storage.size, 0);
        assert.equal(env.redirects[0], "index.html");
    });
});

describe("API helper", () => {
    it("attaches the Bearer token when signed in", async () => {
        const env = createEnv(ENABLED);
        env.window.__response = {
            ok: true,
            status: 200,
            json: async () => ({
                AuthenticationResult: { IdToken: makeToken(unexpiredClaims()) }
            })
        };
        await env.auth.signIn("player@example.com", "password123");

        env.calls.length = 0;
        await env.apiFetch("/api/games");

        const headers = env.calls[0].options.headers;
        assert.match(headers.Authorization, /^Bearer .+\./);
    });

    it("sends no Authorization header when signed out", async () => {
        const env = createEnv(ENABLED);
        await env.apiFetch("/api/games");

        const headers = env.calls[0].options.headers;
        assert.equal(headers.Authorization, undefined);
    });
});

describe("page guard", () => {
    it("redirects unauthenticated visitors to sign-in with ?next", () => {
        const env = createEnv(ENABLED, {
            url: "https://hub.example/play.html",
            search: "?id=4"
        });
        env.auth.requireAuthGuard();

        assert.equal(env.redirects.length, 1);
        assert.equal(
            env.redirects[0],
            "signin.html?next=play.html%3Fid%3D4"
        );
    });

    it("does not redirect when signed in", async () => {
        const env = createEnv(ENABLED);
        env.window.__response = {
            ok: true,
            status: 200,
            json: async () => ({
                AuthenticationResult: { IdToken: makeToken(unexpiredClaims()) }
            })
        };
        await env.auth.signIn("player@example.com", "password123");

        env.auth.requireAuthGuard();
        assert.equal(env.redirects.length, 0);
    });

    it("never redirects when auth is not configured (local dev)", () => {
        const env = createEnv(DISABLED);
        env.auth.requireAuthGuard();
        assert.equal(env.redirects.length, 0);
    });
});
