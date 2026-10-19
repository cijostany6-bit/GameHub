#!/usr/bin/env node
"use strict";

/* =========================================================
 * GameHub — load test
 *
 * Dependency-free (node:http/https only) so the report it
 * produces is reproducible on any machine with Node and
 * without installing a load-testing tool.
 *
 * It hammers a MIX of endpoints, because a single-endpoint
 * benchmark flatters a system:
 *
 *   /                 → CloudFront + S3        (static, cached)
 *   /api/games        → CloudFront → nginx → Express → MySQL
 *   /api/health       → the cheapest possible liveness path
 *
 * What it measures: latency at p50/p90/p95/p99, throughput,
 * status distribution and error rate. What it deliberately does
 * NOT do: saturate the machine until something breaks. The point
 * is an honest number for a single t3.micro, not a stress test
 * with a verdict.
 *
 * Usage:
 *   node scripts/load-test.js --url https://example.com \
 *        --requests 2000 --concurrency 20 [--json out.json] [--md out.md]
 * ========================================================= */

const http = require("node:http");
const https = require("node:https");
const fs = require("node:fs");
const { URL } = require("node:url");

/* ---------------------------------------------------------
 * arguments
 * ------------------------------------------------------- */

function parseArgs(argv) {
    const args = {
        url: null,
        requests: 1000,
        concurrency: 10,
        json: null,
        md: null,
        timeout: 15000,
        token: null
    };

    for (let i = 0; i < argv.length; i += 1) {
        const flag = argv[i];
        const value = argv[i + 1];
        switch (flag) {
            case "--url": args.url = value; i += 1; break;
            case "--requests": args.requests = Number(value); i += 1; break;
            case "--concurrency": args.concurrency = Number(value); i += 1; break;
            case "--json": args.json = value; i += 1; break;
            case "--md": args.md = value; i += 1; break;
            case "--timeout": args.timeout = Number(value); i += 1; break;
            // An ID token. Without it, /api/* answers 401 — which is the
            // auth gate working, not a failure, and is scored as such.
            case "--token": args.token = value; i += 1; break;
            case "--help":
            case "-h":
                printUsage();
                process.exit(0);
                break;
            default:
                if (flag.startsWith("--")) {
                    console.error(`Unknown flag: ${flag}`);
                    printUsage();
                    process.exit(2);
                }
        }
    }

    if (!args.url) {
        console.error("--url is required");
        printUsage();
        process.exit(2);
    }
    if (!Number.isFinite(args.requests) || args.requests < 1) {
        console.error("--requests must be a positive number");
        process.exit(2);
    }
    if (!Number.isFinite(args.concurrency) || args.concurrency < 1) {
        console.error("--concurrency must be a positive number");
        process.exit(2);
    }

    return args;
}

function printUsage() {
    console.error(
        "Usage: node scripts/load-test.js --url <base> " +
        "[--requests N] [--concurrency N] [--json file] [--md file]"
    );
}

/* ---------------------------------------------------------
 * the traffic mix
 *
 * Weights add up to 100. Weights rather than "every third
 * request" so that the mix is stable at any request count.
 *
 * Each entry declares the status it EXPECTS, because
 * "non-2xx = failure" is wrong here: the catalogue route is
 * behind the auth gate, so 401 is the correct answer to an
 * unauthenticated request. With --token it must be 200. A
 * status that is not the expected one is a real finding.
 * ------------------------------------------------------- */

const MIX = [
    { path: "/", weight: 50, label: "static site (CDN)", expect: [200], api: false },
    { path: "/api/games", weight: 30, label: "API list (DB read)", expect: [200], expectAnonymous: [401], api: true },
    { path: "/api/health", weight: 20, label: "liveness probe", expect: [200], api: true }
];

function expectedFor(entry, hasToken) {
    if (!hasToken && entry.expectAnonymous) return entry.expectAnonymous;
    return entry.expect;
}

function pickPath(index) {
    // Deterministic distribution, no Math.random: the same run
    // count produces the same mix, so two runs are comparable.
    const position = (index * 37) % 100;
    let cumulative = 0;
    for (const entry of MIX) {
        cumulative += entry.weight;
        if (position < cumulative) return entry;
    }
    return MIX[0];
}

/* ---------------------------------------------------------
 * a single request
 * ------------------------------------------------------- */

function request(base, entry, args, agent) {
    return new Promise((resolve) => {
        const target = new URL(entry.path, base);
        const transport = target.protocol === "https:" ? https : http;
        const started = process.hrtime.bigint();
        const expected = expectedFor(entry, Boolean(args.token));

        const headers = {
            // Identify this traffic honestly. A load test that
            // pretends to be a browser is a load test nobody can
            // find in the logs afterwards.
            "User-Agent": "GameHub-LoadTest/1.0",
            "Accept": "*/*"
        };
        if (args.token && entry.api) {
            headers.Authorization = `Bearer ${args.token}`;
        }

        const req = transport.request(target, { method: "GET", agent, headers },
            (res) => {
                // Drain the body — a response is not complete until the
                // body is read, and an undrained socket poisons keep-alive.
                res.resume();
                res.on("end", () => {
                    const ms = Number(process.hrtime.bigint() - started) / 1e6;
                    resolve({
                        path: entry.path,
                        status: res.statusCode,
                        ms,
                        ok: true,
                        expected: expected.includes(res.statusCode)
                    });
                });
            });

        req.setTimeout(args.timeout, () => {
            req.destroy(new Error("timeout"));
        });

        req.on("error", (error) => {
            const ms = Number(process.hrtime.bigint() - started) / 1e6;
            resolve({
                path: entry.path,
                status: 0,
                ms,
                ok: false,
                expected: false,
                error: error.message
            });
        });

        req.end();
    });
}

/* ---------------------------------------------------------
 * percentiles
 * ------------------------------------------------------- */

function percentile(sorted, p) {
    if (sorted.length === 0) return 0;
    const index = Math.min(
        sorted.length - 1,
        Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)
    );
    return sorted[index];
}

function round(n) {
    return Math.round(n * 100) / 100;
}

/* ---------------------------------------------------------
 * main
 * ------------------------------------------------------- */

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const base = args.url.endsWith("/") ? args.url : `${args.url}/`;

    const transport = new URL(base).protocol === "https:" ? https : http;
    // Keep-alive with a socket ceiling equal to the concurrency:
    // that is what makes this a concurrency test rather than a
    // connection-churn test.
    const agent = new transport.Agent({
        keepAlive: true,
        maxSockets: args.concurrency
    });

    console.log(`Load test → ${base}`);
    console.log(
        `  ${args.requests} requests, concurrency ${args.concurrency}, ` +
        `mix: ${MIX.map((m) => `${m.weight}% ${m.path}`).join(", ")}`
    );
    console.log(
        args.token
            ? "  authenticated: /api/* carries a real ID token (DB path exercised)"
            : "  anonymous: /api/games is expected to answer 401 (gate on, DB not touched)"
    );

    const results = [];
    const startedWall = Date.now();
    let issued = 0;

    async function worker() {
        while (true) {
            const index = issued;
            issued += 1;
            if (index >= args.requests) return;
            const entry = pickPath(index);
            results.push(await request(base, entry, args, agent));
        }
    }

    const workers = [];
    for (let i = 0; i < Math.min(args.concurrency, args.requests); i += 1) {
        workers.push(worker());
    }
    await Promise.all(workers);

    const elapsedSeconds = (Date.now() - startedWall) / 1000;
    agent.destroy();

    /* ---------- aggregate ---------- */

    const latencies = results.map((r) => r.ms).sort((a, b) => a - b);
    const failures = results.filter((r) => !r.ok);
    // "Unexpected" is status-not-as-expected OR a connection error.
    // A 401 on the gated catalogue route is expected and is not a fault.
    const unexpected = results.filter((r) => !r.expected);

    const byStatus = {};
    for (const r of results) {
        const key = r.ok ? String(r.status) : "connection error";
        byStatus[key] = (byStatus[key] || 0) + 1;
    }

    const perPath = {};
    for (const entry of MIX) {
        const rows = results.filter((r) => r.path === entry.path);
        if (rows.length === 0) continue;
        const sorted = rows.map((r) => r.ms).sort((a, b) => a - b);
        const expected = expectedFor(entry, Boolean(args.token));
        perPath[entry.path] = {
            label: entry.label,
            count: rows.length,
            p50: round(percentile(sorted, 50)),
            p95: round(percentile(sorted, 95)),
            max: round(sorted[sorted.length - 1]),
            unexpected: rows.filter((r) => !r.expected).length,
            expected_statuses: expected
        };
    }

    const summary = {
        target: base,
        requests: args.requests,
        concurrency: args.concurrency,
        authenticated: Boolean(args.token),
        duration_seconds: round(elapsedSeconds),
        throughput_rps: round(args.requests / elapsedSeconds),
        latency_ms: {
            min: round(latencies[0]),
            mean: round(latencies.reduce((a, b) => a + b, 0) / latencies.length),
            p50: round(percentile(latencies, 50)),
            p90: round(percentile(latencies, 90)),
            p95: round(percentile(latencies, 95)),
            p99: round(percentile(latencies, 99)),
            max: round(latencies[latencies.length - 1])
        },
        status_counts: byStatus,
        connection_errors: failures.length,
        unexpected_responses: unexpected.length,
        success_rate_percent: round(
            ((results.length - unexpected.length) / results.length) * 100
        ),
        per_path: perPath,
        mix: MIX.map((m) => ({
            path: m.path,
            weight: m.weight,
            label: m.label,
            expected: expectedFor(m, Boolean(args.token))
        }))
    };

    /* ---------- report ---------- */

    console.log("\nResults");
    console.log(
        `  ${summary.requests} requests in ${summary.duration_seconds}s ` +
        `→ ${summary.throughput_rps} req/s`
    );
    console.log(
        `  latency  p50 ${summary.latency_ms.p50}ms · ` +
        `p90 ${summary.latency_ms.p90}ms · ` +
        `p95 ${summary.latency_ms.p95}ms · ` +
        `p99 ${summary.latency_ms.p99}ms · ` +
        `max ${summary.latency_ms.max}ms`
    );
    console.log(`  status   ${JSON.stringify(byStatus)}`);
    console.log(
        `  expected ${summary.success_rate_percent}% ` +
        `(${summary.unexpected_responses} unexpected, ` +
        `${summary.connection_errors} connection errors)`
    );
    for (const [path, row] of Object.entries(perPath)) {
        console.log(
            `    ${path.padEnd(14)} ${String(row.count).padStart(5)} req · ` +
            `p50 ${row.p50}ms · p95 ${row.p95}ms · ` +
            `expects ${row.expected_statuses.join("/")} · ` +
            `${row.unexpected} unexpected · ${row.label}`
        );
    }

    if (args.json) {
        fs.writeFileSync(args.json, `${JSON.stringify(summary, null, 2)}\n`);
        console.log(`\nJSON written to ${args.json}`);
    }

    if (args.md) {
        fs.writeFileSync(args.md, renderMarkdown(summary));
        console.log(`Markdown written to ${args.md}`);
    }
}

/* ---------------------------------------------------------
 * Markdown report — paste-ready for docs/load-test.md
 * ------------------------------------------------------- */

function renderMarkdown(s) {
    const lines = [];
    lines.push(`### Run: ${s.requests} requests, concurrency ${s.concurrency}`);
    lines.push("");
    lines.push(`- **Target:** \`${s.target}\``);
    lines.push(
        `- **Mode:** ${s.authenticated
            ? "authenticated (a real ID token, so the API reaches the database)"
            : "anonymous (the catalogue route answers 401 — the gate working)"}`
    );
    lines.push(`- **Duration:** ${s.duration_seconds} s`);
    lines.push(`- **Throughput:** ${s.throughput_rps} req/s`);
    lines.push(`- **Responses as expected:** ${s.success_rate_percent} %`);
    lines.push(`- **Unexpected responses:** ${s.unexpected_responses}`);
    lines.push(`- **Connection errors:** ${s.connection_errors}`);
    lines.push("");
    lines.push("| Latency | ms |");
    lines.push("|---|---|");
    lines.push(`| min | ${s.latency_ms.min} |`);
    lines.push(`| mean | ${s.latency_ms.mean} |`);
    lines.push(`| p50 | ${s.latency_ms.p50} |`);
    lines.push(`| p90 | ${s.latency_ms.p90} |`);
    lines.push(`| p95 | ${s.latency_ms.p95} |`);
    lines.push(`| p99 | ${s.latency_ms.p99} |`);
    lines.push(`| max | ${s.latency_ms.max} |`);
    lines.push("");
    lines.push("| Endpoint | Requests | p50 (ms) | p95 (ms) | Max (ms) | Expected | Unexpected | What it exercises |");
    lines.push("|---|---|---|---|---|---|---|---|");
    for (const [path, row] of Object.entries(s.per_path)) {
        lines.push(
            `| \`${path}\` | ${row.count} | ${row.p50} | ${row.p95} | ` +
            `${row.max} | ${row.expected_statuses.join("/")} | ${row.unexpected} | ${row.label} |`
        );
    }
    lines.push("");
    lines.push("| Status | Count |");
    lines.push("|---|---|");
    for (const [status, count] of Object.entries(s.status_counts)) {
        lines.push(`| ${status} | ${count} |`);
    }
    lines.push("");
    return `${lines.join("\n")}\n`;
}

main().catch((error) => {
    console.error("Load test failed:", error.message);
    process.exit(1);
});
