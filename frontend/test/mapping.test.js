"use strict";

/* =========================================================
   Coverage contract: every game in the database seed must map
   to a real engine in play.js. This is the automated form of
   the product promise "every catalogue entry opens an actual
   game" — a new seed row without an engine fails CI.
   ========================================================= */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..", "..");
const SEED = fs.readFileSync(path.join(ROOT, "db", "init.sql"), "utf8");
const PLAY = fs.readFileSync(path.join(ROOT, "frontend", "play.js"), "utf8");
const ENGINES = fs.readFileSync(
    path.join(ROOT, "frontend", "engines.js"),
    "utf8"
);

const seededNames = [...SEED.matchAll(/\('([^']+)',\s*'(Action|Racing|Strategy)'/g)]
    .map((match) => match[1]);

const mappedNames = [...PLAY.matchAll(/"([^"]+)":\s*\{\s*\n\s*engine:\s*"(\w+)"/g)]
    .map((match) => match[1]);

const registryEngines = [
    ...ENGINES.matchAll(/^\s{8}(\w+):\s*create\w+/gm)
].map((match) => match[1]);

describe("engine coverage contract", () => {
    it("finds the expected number of seeded games", () => {
        assert.equal(seededNames.length, 12);
        assert.equal(mappedNames.length, 12);
    });

    it("every seeded title has an engine mapping (no dead entries)", () => {
        const missing = seededNames.filter(
            (name) => !mappedNames.includes(name)
        );
        assert.deepEqual(
            missing,
            [],
            `these seeded games have no engine: ${missing.join(", ")}`
        );
    });

    it("no mapping exists for a game that is not in the seed", () => {
        const orphans = mappedNames.filter(
            (name) => !seededNames.includes(name)
        );
        assert.deepEqual(
            orphans,
            [],
            `these mappings match no seeded game: ${orphans.join(", ")}`
        );
    });

    it("every mapping points at a registered engine", () => {
        const used = [...PLAY.matchAll(/engine:\s*"(\w+)"/g)]
            .map((match) => match[1]);
        const unknown = used.filter(
            (engine) => !registryEngines.includes(engine)
        );
        assert.deepEqual(
            unknown,
            [],
            `unknown engines referenced: ${unknown.join(", ")}`
        );
        assert.equal(new Set(used).size, 6, "all six engines are used");
    });
});
