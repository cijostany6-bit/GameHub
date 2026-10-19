"use strict";

/* =========================================================
   SigV4 signer + metadata credentials (backend/cognito.js).
   ---------------------------------------------------------
   Unit tests for the parts the route tests cannot reach: the
   signature itself, the instance-metadata (IMDSv2) hop, and
   the two "wrong configuration" errors.

   IMDS_ENDPOINT points the client at a local server, so the
   IMDSv2 dance (token → role → credentials) is really
   executed rather than described in a comment.
   ========================================================= */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

const cognito = require("../cognito");

describe("SigV4 signing", () => {
    it("formats the timestamp the way the signature requires", () => {
        assert.equal(
            cognito._amzDate(new Date("2026-10-19T08:30:45.123Z")),
            "20261019T083045Z"
        );
    });

    it("hashes with sha256 (known vector)", () => {
        // The classic SHA-256("abc") test vector.
        assert.equal(
            cognito._sha256Hex("abc"),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
    });

    it("produces a credential scope, signed headers and a 64-hex signature", () => {
        const headers = cognito._sign({
            method: "POST",
            host: "cognito-idp.eu-central-1.amazonaws.com",
            path: "/",
            body: JSON.stringify({ UserPoolId: "eu-central-1_X", Username: "a@b.c" }),
            credentials: { accessKeyId: "AKIATEST", secretAccessKey: "secret" },
            region: "eu-central-1",
            target: "AWSCognitoIdentityProviderService.AdminDeleteUser",
            date: new Date("2026-10-19T08:30:45.123Z")
        });

        assert.match(
            headers.authorization,
            /^AWS4-HMAC-SHA256 Credential=AKIATEST\/20261019\/eu-central-1\/cognito-idp\/aws4_request, SignedHeaders=content-type;host;x-amz-date;x-amz-target, Signature=[0-9a-f]{64}$/
        );
        assert.equal(headers["x-amz-date"], "20261019T083045Z");
        assert.equal(
            headers["x-amz-target"],
            "AWSCognitoIdentityProviderService.AdminDeleteUser"
        );
        // Temporary credentials must be part of the signature, because
        // the API rejects a session token that was not signed.
        assert.equal(headers["x-amz-security-token"], undefined);
    });

    it("includes a session token in the signed headers when one is used", () => {
        const base = {
            method: "POST",
            host: "cognito-idp.eu-central-1.amazonaws.com",
            path: "/",
            body: "{}",
            region: "eu-central-1",
            target: "AWSCognitoIdentityProviderService.AdminDeleteUser",
            date: new Date("2026-10-19T08:30:45.123Z")
        };
        const withToken = cognito._sign({
            ...base,
            credentials: {
                accessKeyId: "AKIATEST",
                secretAccessKey: "secret",
                sessionToken: "session-token-value"
            }
        });
        const withoutToken = cognito._sign({
            ...base,
            credentials: { accessKeyId: "AKIATEST", secretAccessKey: "secret" }
        });

        assert.equal(withToken["x-amz-security-token"], "session-token-value");
        assert.match(withToken.authorization, /SignedHeaders=[^,]*x-amz-security-token/);
        assert.notEqual(
            withToken.authorization.split("Signature=")[1],
            withoutToken.authorization.split("Signature=")[1],
            "adding a session token must change the signature"
        );
    });

    it("signs the payload, so a changed body changes the signature", () => {
        const base = {
            method: "POST",
            host: "cognito-idp.eu-central-1.amazonaws.com",
            path: "/",
            credentials: { accessKeyId: "AKIATEST", secretAccessKey: "secret" },
            region: "eu-central-1",
            target: "AWSCognitoIdentityProviderService.AdminDeleteUser",
            date: new Date("2026-10-19T08:30:45.123Z")
        };
        const a = cognito._sign({ ...base, body: JSON.stringify({ Username: "alice" }) });
        const b = cognito._sign({ ...base, body: JSON.stringify({ Username: "bob" }) });
        const again = cognito._sign({ ...base, body: JSON.stringify({ Username: "alice" }) });

        assert.notEqual(a.authorization, b.authorization);
        // …and a different secret must too.
        const otherSecret = cognito._sign({
            ...base,
            body: JSON.stringify({ Username: "alice" }),
            credentials: { accessKeyId: "AKIATEST", secretAccessKey: "other" }
        });
        assert.notEqual(a.authorization, otherSecret.authorization);
        // Deterministic for identical inputs (same date, same body).
        assert.equal(a.authorization, again.authorization);
    });
});

describe("instance credentials (IMDSv2)", () => {
    let imdsServer;
    let calls;
    let behaviour;

    before(async () => {
        behaviour = "ok";
        calls = [];
        imdsServer = http.createServer((req, res) => {
            calls.push({ method: req.method, url: req.url, token: req.headers["x-aws-ec2-metadata-token"] });

            if (req.method === "PUT" && req.url === "/latest/api/token") {
                if (behaviour === "token-denied") {
                    res.statusCode = 403;
                    res.end("nope");
                    return;
                }
                res.end("imds-session-token");
                return;
            }
            if (req.url === "/latest/meta-data/iam/security-credentials/") {
                res.end("gamehub-prod-ec2-role");
                return;
            }
            if (req.url.startsWith("/latest/meta-data/iam/security-credentials/")) {
                res.setHeader("content-type", "application/json");
                res.end(JSON.stringify({
                    AccessKeyId: "ASIAINSTANCE",
                    SecretAccessKey: "instance-secret",
                    Token: "instance-session-token"
                }));
                return;
            }
            res.statusCode = 404;
            res.end("not found");
        });
        await new Promise((resolve) => imdsServer.listen(0, "127.0.0.1", resolve));
        process.env.IMDS_ENDPOINT = `http://127.0.0.1:${imdsServer.address().port}`;
    });

    after(async () => {
        await new Promise((resolve) => imdsServer.close(resolve));
        delete process.env.IMDS_ENDPOINT;
    });

    it("follows the token → role → credentials dance and signs with them", async () => {
        delete process.env.AWS_ACCESS_KEY_ID;
        delete process.env.AWS_SECRET_ACCESS_KEY;

        let captured;
        const endpoint = http.createServer((req, res) => {
            captured = {
                target: req.headers["x-amz-target"],
                authorization: req.headers.authorization,
                securityToken: req.headers["x-amz-security-token"]
            };
            res.end("{}");
        });
        await new Promise((resolve) => endpoint.listen(0, "127.0.0.1", resolve));

        try {
            await cognito.deleteUser("player@example.com", {
                userPoolId: "eu-central-1_POOL",
                endpoint: `http://127.0.0.1:${endpoint.address().port}`,
                region: "eu-central-1"
            });
        } finally {
            await new Promise((resolve) => endpoint.close(resolve));
        }

        // The IMDSv2 sequence, with the session token attached to each GET.
        assert.equal(calls[0].method, "PUT");
        assert.equal(calls[0].url, "/latest/api/token");
        assert.equal(calls[1].method, "GET");
        assert.equal(calls[1].token, "imds-session-token");
        assert.equal(calls[2].token, "imds-session-token");

        assert.match(captured.authorization, /Credential=ASIAINSTANCE\//);
        assert.equal(captured.securityToken, "instance-session-token");
        assert.equal(
            captured.target,
            "AWSCognitoIdentityProviderService.AdminDeleteUser"
        );
    });

    it("fails loudly when the metadata service refuses the token", async () => {
        delete process.env.AWS_ACCESS_KEY_ID;
        behaviour = "token-denied";
        try {
            await assert.rejects(
                () => cognito.deleteUser("player@example.com", {
                    userPoolId: "eu-central-1_POOL",
                    region: "eu-central-1",
                    endpoint: "http://127.0.0.1:1"
                }),
                /imds_403/
            );
        } finally {
            behaviour = "ok";
        }
    });
});

describe("misconfiguration is an error, not a silent skip", () => {
    it("refuses to delete without a user pool id", async () => {
        const saved = process.env.COGNITO_USER_POOL_ID;
        delete process.env.COGNITO_USER_POOL_ID;
        try {
            await assert.rejects(
                () => cognito.deleteUser("player@example.com", {}),
                /cognito_not_configured/
            );
        } finally {
            process.env.COGNITO_USER_POOL_ID = saved;
        }
    });

    it("refuses to sign without a region", async () => {
        const saved = process.env.COGNITO_REGION;
        delete process.env.COGNITO_REGION;
        try {
            await assert.rejects(
                () => cognito.deleteUser("player@example.com", {
                    userPoolId: "eu-central-1_POOL"
                }),
                /cognito_not_configured/
            );
        } finally {
            process.env.COGNITO_REGION = saved;
        }
    });

    it("surfaces a Cognito error status instead of swallowing it", async () => {
        const endpoint = http.createServer((req, res) => {
            res.statusCode = 400;
            res.end(JSON.stringify({ __type: "UserNotFoundException" }));
        });
        await new Promise((resolve) => endpoint.listen(0, "127.0.0.1", resolve));

        try {
            await assert.rejects(
                () => cognito.deleteUser("ghost@example.com", {
                    userPoolId: "eu-central-1_POOL",
                    endpoint: `http://127.0.0.1:${endpoint.address().port}`,
                    region: "eu-central-1",
                    credentials: { accessKeyId: "AKIA", secretAccessKey: "s" }
                }),
                (error) => {
                    assert.equal(error.status, 400);
                    assert.match(error.detail, /UserNotFoundException/);
                    return true;
                }
            );
        } finally {
            await new Promise((resolve) => endpoint.close(resolve));
        }
    });
});
