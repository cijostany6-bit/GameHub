"use strict";

/* =========================================================
   Cognito admin calls — dependency-free, SigV4-signed.
   ---------------------------------------------------------
   Deleting a player's account means deleting the identity
   itself (the email that Cognito holds), and that is an
   admin API: AdminDeleteUser. It needs an AWS Signature
   Version 4 request, which normally means the AWS SDK.

   This project does not ship the SDK in the API image
   (auth.js made the same decision for JWTs), so the signing
   is implemented here with node:crypto — about forty lines
   that are worth understanding anyway, because SigV4 is what
   makes every AWS API call work.

   Credentials come from the instance role through IMDSv2
   (no keys on disk, nothing in Git). For tests and local
   runs, AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY and
   COGNITO_ENDPOINT override both the credentials and the
   host, so the real signing path is exercised against a
   local HTTP server rather than mocked away.
   ========================================================= */

const crypto = require("node:crypto");

const IMDS_BASE = "http://169.254.169.254";
const SERVICE = "cognito-idp";

// Overridable so a test can stand in for the metadata service; the
// default is the link-local address the EC2 instance actually serves.
function imdsBase() {
    return process.env.IMDS_ENDPOINT || IMDS_BASE;
}

function sha256Hex(data) {
    return crypto.createHash("sha256").update(data).digest("hex");
}

function hmac(key, data) {
    return crypto.createHmac("sha256", key).update(data).digest();
}

// 2026-10-19T08:30:00.000Z → 20261019T083000Z
function amzDate(date) {
    return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

async function imds(path, token) {
    const response = await fetch(`${imdsBase()}${path}`, {
        method: token === null ? "PUT" : "GET",
        headers: token === null
            ? { "x-aws-ec2-metadata-token-ttl-seconds": "21600" }
            : { "x-aws-ec2-metadata-token": token }
    });
    if (!response.ok) {
        throw new Error(`imds_${response.status}`);
    }
    return response.text();
}

// IMDSv2, which is enforced on the host (see infra/backend.yaml).
async function instanceCredentials() {
    const token = await imds("/latest/api/token", null);
    const role = (await imds(
        "/latest/meta-data/iam/security-credentials/",
        token
    )).trim();
    const body = JSON.parse(await imds(
        `/latest/meta-data/iam/security-credentials/${role}`,
        token
    ));
    return {
        accessKeyId: body.AccessKeyId,
        secretAccessKey: body.SecretAccessKey,
        sessionToken: body.Token
    };
}

/* ---------------------------------------------------------
   Sign a request the way the AWS docs describe, in five steps:
     1. canonical request — method, path, query, headers, payload hash
     2. string to sign    — algorithm, timestamp, scope, hash of step 1
     3. signing key       — a chain of HMACs from the secret, in order
     4. signature         — HMAC of step 2 with the key from step 3
     5. Authorization header
   The signature covers the timestamp, so a replay window is minutes,
   not months; that is why this cannot just be a static header.
   --------------------------------------------------------- */
function sign({ method, host, path, body, credentials, region, target, date }) {
    const timestamp = amzDate(date);
    const dateStamp = timestamp.slice(0, 8);

    const headers = {
        "content-type": "application/x-amz-json-1.1",
        host,
        "x-amz-date": timestamp,
        "x-amz-target": target
    };
    if (credentials.sessionToken) {
        headers["x-amz-security-token"] = credentials.sessionToken;
    }

    const signedHeaderNames = Object.keys(headers).sort();
    const canonicalHeaders = signedHeaderNames
        .map((name) => `${name}:${headers[name]}\n`)
        .join("");
    const signedHeaders = signedHeaderNames.join(";");

    const canonicalRequest = [
        method,
        path,
        "", // no query string
        canonicalHeaders,
        signedHeaders,
        sha256Hex(body)
    ].join("\n");

    const scope = `${dateStamp}/${region}/${SERVICE}/aws4_request`;
    const stringToSign = [
        "AWS4-HMAC-SHA256",
        timestamp,
        scope,
        sha256Hex(canonicalRequest)
    ].join("\n");

    const signingKey = hmac(
        hmac(hmac(hmac(`AWS4${credentials.secretAccessKey}`, dateStamp), region), SERVICE),
        "aws4_request"
    );
    const signature = crypto
        .createHmac("sha256", signingKey)
        .update(stringToSign)
        .digest("hex");

    const authorization = "AWS4-HMAC-SHA256 " +
        `Credential=${credentials.accessKeyId}/${scope}, ` +
        `SignedHeaders=${signedHeaders}, Signature=${signature}`;

    // Return headers ready for fetch — the Host header is set by the
    // HTTP client from the URL, and signing it separately would make
    // the signature wrong for any endpoint that carries a port.
    return {
        "content-type": headers["content-type"],
        "x-amz-date": headers["x-amz-date"],
        "x-amz-target": headers["x-amz-target"],
        ...(credentials.sessionToken
            ? { "x-amz-security-token": credentials.sessionToken }
            : {}),
        authorization
    };
}

/* Call an admin API. `endpoint` exists for tests: production always
   talks to the regional Cognito endpoint over TLS. */
async function adminCall(action, payload, options = {}) {
    const region = options.region || process.env.COGNITO_REGION;
    if (!region) {
        throw new Error("cognito_not_configured");
    }

    // Skip the instance metadata service when explicit credentials
    // are present (tests, or a developer running this off-instance).
    const credentials = options.credentials ||
        (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
            ? {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
                sessionToken: process.env.AWS_SESSION_TOKEN
            }
            : await instanceCredentials());

    const endpoint = options.endpoint ||
        process.env.COGNITO_ENDPOINT ||
        `https://${SERVICE}.${region}.amazonaws.com`;
    const url = new URL(endpoint);
    const body = JSON.stringify(payload);

    const headers = sign({
        method: "POST",
        host: url.host,
        path: "/",
        body,
        credentials,
        region,
        target: `AWSCognitoIdentityProviderService.${action}`,
        date: new Date()
    });

    const response = await fetch(url, { method: "POST", headers, body });
    const text = await response.text();
    if (!response.ok) {
        const error = new Error(`cognito_${response.status}`);
        error.status = response.status;
        error.detail = text.slice(0, 500);
        throw error;
    }
    return text ? JSON.parse(text) : {};
}

/* Delete the player's identity. This is the part of account deletion
   that the database cannot do, and the part a GDPR erasure request is
   really about: the email address. */
async function deleteUser(username, options = {}) {
    const poolId = options.userPoolId || process.env.COGNITO_USER_POOL_ID;
    if (!poolId) {
        throw new Error("cognito_not_configured");
    }
    return adminCall("AdminDeleteUser", {
        UserPoolId: poolId,
        Username: username
    }, options);
}

module.exports = {
    deleteUser,
    // exported for tests: the signature is the interesting part
    _sign: sign,
    _sha256Hex: sha256Hex,
    _amzDate: amzDate
};
