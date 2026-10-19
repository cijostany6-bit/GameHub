"use strict";

// =========================================================
// Express application (exported for tests).
// The HTTP listener lives in server.js so tests can mount
// this app on an ephemeral port without side effects.
// =========================================================

const express = require("express");
const cors = require("cors");
const { pool, ping } = require("./db");
const { requireAuth, authEnabled } = require("./auth");

const app = express();

app.disable("x-powered-by");

// Same-origin via the nginx proxy means CORS rarely applies,
// but lock it down to explicit origins instead of wildcard.
const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:8080")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: "100kb" }));

// ---------------------------------------------------------
// Authentication gate (Phase 4). Enforced ONLY when a Cognito
// user pool is configured; health/readiness probes stay open
// so orchestrators can always reach them.
// ---------------------------------------------------------
app.use("/api", (req, res, next) => {
    if (req.path === "/health" || req.path === "/ready") {
        next();
        return;
    }
    requireAuth(req, res, next);
});

if (!authEnabled()) {
    console.warn(JSON.stringify({
        ts: new Date().toISOString(),
        level: "warn",
        msg: "auth_disabled",
        detail: "COGNITO_REGION/USER_POOL_ID/CLIENT_ID not set — " +
            "API is open. Configure the pool to enforce sign-in."
    }));
}

// Structured access log: one JSON object per line — ready for
// the observability stack in Phase 3.
app.use((req, res, next) => {
    const start = process.hrtime.bigint();
    res.on("finish", () => {
        const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
        console.log(JSON.stringify({
            ts: new Date().toISOString(),
            level: "info",
            msg: "request",
            method: req.method,
            path: req.originalUrl,
            status: res.statusCode,
            duration_ms: Number(durationMs.toFixed(1))
        }));
    });
    next();
});

// ---------------------------------------------------------
// Liveness — is the process up? NEVER touches the database,
// so a DB outage does not make the container look "dead"
// and get restarted in a crash loop.
// ---------------------------------------------------------
app.get("/api/health", (req, res) => {
    res.json({
        status: "healthy",
        service: "gamehub-backend",
        timestamp: new Date().toISOString()
    });
});

// ---------------------------------------------------------
// Readiness — can we actually serve traffic? This is the
// endpoint the orchestrator should gate routing on.
// ---------------------------------------------------------
app.get("/api/ready", async (req, res) => {
    try {
        await ping();
        res.json({
            status: "ready",
            service: "gamehub-backend",
            database: "up",
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error(JSON.stringify({
            ts: new Date().toISOString(),
            level: "error",
            msg: "readiness_probe_failed",
            error_code: error.code || "UNKNOWN"
        }));
        res.status(503).json({
            status: "not_ready",
            service: "gamehub-backend",
            database: "down",
            timestamp: new Date().toISOString()
        });
    }
});

// ---------------------------------------------------------
// Games catalogue
// ---------------------------------------------------------
app.get("/api/games", async (req, res) => {
    try {
        const [rows] = await pool.query(
            "SELECT id, name, category, description FROM games ORDER BY id"
        );
        res.json(rows);
    } catch (error) {
        // Full detail goes to the log; clients get a generic body.
        console.error(JSON.stringify({
            ts: new Date().toISOString(),
            level: "error",
            msg: "games_query_failed",
            error_code: error.code || "UNKNOWN"
        }));
        res.status(500).json({ error: "Failed to retrieve games" });
    }
});

// Single game — powers play.html (the runner needs one title,
// not the whole catalogue). Unknown or non-numeric ids: 404.
app.get("/api/games/:id", async (req, res) => {    try {
        const [rows] = await pool.query(
            "SELECT id, name, category, description FROM games WHERE id = ?",
            [req.params.id]
        );
        if (rows.length === 0) {
            res.status(404).json({ error: "Game not found" });
            return;
        }
        res.json(rows[0]);
    } catch (error) {
        console.error(JSON.stringify({
            ts: new Date().toISOString(),
            level: "error",
            msg: "game_detail_query_failed",
            error_code: error.code || "UNKNOWN"
        }));
        res.status(500).json({ error: "Failed to retrieve game" });
    }
});

// ---------------------------------------------------------
// Identity echo — proves the JWT was verified end to end.
// ---------------------------------------------------------
app.get("/api/me", (req, res) => {
    if (!authEnabled()) {
        res.status(401).json({ error: "Authentication is not configured" });
        return;
    }
    res.json({
        sub: req.user.sub,
        email: req.user.email,
        username: req.user.username
    });
});

// ---------------------------------------------------------
// 404 + central error handler — internals never leak.
// ---------------------------------------------------------
app.use((req, res) => {
    res.status(404).json({ error: "Not found" });
});

// Body-parser failures (malformed JSON) are client errors.
app.use((error, req, res, next) => {
    if (error.type === "entity.parse.failed") {
        res.status(400).json({ error: "Invalid JSON body" });
        return;
    }
    if (error.type === "entity.too.large") {
        res.status(413).json({ error: "Request body too large" });
        return;
    }
    next(error);
});

app.use((error, req, res, _next) => {
    console.error(JSON.stringify({
        ts: new Date().toISOString(),
        level: "error",
        msg: "unhandled_error",
        error_message: error.message
    }));
    res.status(500).json({ error: "Internal server error" });
});

module.exports = app;
