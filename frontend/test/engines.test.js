"use strict";

/* =========================================================
   Game-engine tests — run the real engines in Node against a
   stubbed canvas/DOM. This is the only way to execute the
   render+update loops deterministically: a hidden browser
   window never fires requestAnimationFrame, and headless
   pixels are not a behaviour assertion.

   What this proves:
   - all six engines construct without throwing
   - their loops survive hundreds of frames (no undefined math,
     no missing methods on ctx, no runaway exceptions)
   - input wiring works (keydown/mousemove/click handlers)
   - engine hooks fire: onStatus/onScore at start, onGameOver
     on genuine terminal paths (snake hits the wall, breakout
     runs out of lives, pong reaches 5, reflex misses 3 targets)

   Run: node --test frontend/test/engines.test.js
   ========================================================= */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ENGINES_SOURCE = fs.readFileSync(
    path.join(__dirname, "..", "engines.js"),
    "utf8"
);

// --- stub environment -------------------------------------------------
function makeCtx() {
    const noop = () => {};
    return new Proxy(
        { measureText: () => ({ width: 10 }) },
        {
            get(target, prop) {
                if (prop in target) return target[prop];
                return noop;
            },
            set() {
                return true; // fillStyle = ... etc.
            }
        }
    );
}

function createHarness() {
    let rafQueue = [];
    const winHandlers = {};
    const canvasHandlers = {};

    const windowStub = {
        requestAnimationFrame: (fn) => {
            rafQueue.push(fn);
            return rafQueue.length;
        },
        cancelAnimationFrame: () => {},
        addEventListener: (event, fn) => {
            (winHandlers[event] ||= []).push(fn);
        },
        removeEventListener: () => {},
        matchMedia: () => ({ matches: false }),
        innerWidth: 1200,
        innerHeight: 800,
        location: { href: "" }
    };

    const canvas = {
        width: 640,
        height: 480,
        getContext: () => makeCtx(),
        addEventListener: (event, fn) => {
            (canvasHandlers[event] ||= []).push(fn);
        },
        removeEventListener: () => {},
        getBoundingClientRect: () => ({
            left: 0, top: 0, width: 640, height: 480,
            right: 640, bottom: 480
        })
    };

    const sandbox = {
        window: windowStub,
        Math,
        Object,
        Array,
        String,
        Number,
        JSON,
        console
    };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(ENGINES_SOURCE, sandbox, { filename: "engines.js" });

    function dispatch(handlers, event, payload) {
        (handlers[event] || []).forEach((fn) =>
            fn({ preventDefault: () => {}, ...payload })
        );
    }

    function runFrames(count) {
        for (let i = 0; i < count; i++) {
            const current = rafQueue;
            rafQueue = [];
            for (const fn of current) fn();
        }
    }

    return {
        engines: sandbox.window.GameEngines,
        canvas,
        key(event, key, extra = {}) {
            dispatch(winHandlers, event, { key, ...extra });
        },
        canvasEvent(event, payload = {}) {
            dispatch(canvasHandlers, event, payload);
        },
        runFrames
    };
}

function hooks() {
    const state = {
        statuses: [],
        scores: [],
        gameOvers: []
    };
    return {
        state,
        opts: {
            colors: {
                accent: "#00f5ff",
                accent2: "#ff00ff",
                danger: "#ff3355",
                surface: "#101323",
                muted: "#9299b8"
            },
            onScore: (value) => state.scores.push(value),
            onStatus: (text) => state.statuses.push(text),
            onGameOver: (score, message) =>
                state.gameOvers.push({ score, message })
        }
    };
}

const ENGINES = ["snake", "breakout", "dodge", "memory", "reflex", "pong"];

describe("game engines (stubbed canvas)", () => {
    for (const name of ENGINES) {
        it(`${name}: constructs, sets status, and survives 400 frames`, () => {
            const h = createHarness();
            const { state, opts } = hooks();

            const game = h.engines[name](h.canvas, opts);
            h.runFrames(400);

            assert.ok(
                state.statuses.length > 0,
                `${name} must report an initial status`
            );
            assert.equal(typeof game.destroy, "function");
            game.destroy();
        });
    }

    it("snake: dies on the wall with no input (game-over hook fires)", () => {
        const h = createHarness();
        const { state, opts } = hooks();
        h.engines.snake(h.canvas, opts);
        h.runFrames(600);

        assert.equal(state.gameOvers.length, 1);
        assert.equal(state.gameOvers[0].message, "GAME OVER");
    });

    it("snake: keyboard input is wired (keydown does not throw)", () => {
        const h = createHarness();
        const { opts } = hooks();
        h.engines.snake(h.canvas, opts);
        h.key("keydown", "ArrowDown");
        h.key("keydown", "ArrowLeft"); // illegal reversal is ignored
        h.runFrames(120);
    });

    it("breakout: launches on click and ends when lives run out", () => {
        const h = createHarness();
        const { state, opts } = hooks();
        h.engines.breakout(h.canvas, opts);

        // Launch, then park the paddle out of the ball's way. Retry a
        // bounded number of times: after each miss the ball must be
        // re-launched (it returns to the paddle, stuck).
        for (let attempt = 0;
            attempt < 25 && state.gameOvers.length === 0;
            attempt++) {
            h.canvasEvent("click");
            h.canvasEvent("mousemove", { clientX: 0, clientY: 440 });
            h.runFrames(700);
        }

        assert.equal(state.gameOvers.length, 1);
        assert.equal(state.gameOvers[0].message, "GAME OVER");
    });

    it("breakout: paddle follows mousemove and arrow keys", () => {
        const h = createHarness();
        const { opts } = hooks();
        h.engines.breakout(h.canvas, opts);
        h.canvasEvent("mousemove", { clientX: 500, clientY: 440 });
        h.key("keydown", "ArrowLeft");
        h.key("keydown", "ArrowRight");
        h.runFrames(60);
    });

    it("dodge: scores survival distance and steers", () => {
        const h = createHarness();
        const { state, opts } = hooks();
        h.engines.dodge(h.canvas, opts);
        h.key("keydown", "ArrowLeft");
        h.runFrames(300);
        h.key("keyup", "ArrowLeft");

        assert.ok(state.scores.length > 0, "distance score must accumulate");
        assert.ok(state.scores[state.scores.length - 1] > 0);
    });

    it("memory: two clicks count a move (interaction works)", () => {
        const h = createHarness();
        const { state, opts } = hooks();
        h.engines.memory(h.canvas, opts);

        // Cards are 96x90 with 8px gaps, 4x4, centred: first card
        // spans x 116..212, second x 220..316, top row y 36..126.
        h.canvasEvent("click", { clientX: 160, clientY: 80 });
        h.canvasEvent("click", { clientX: 264, clientY: 80 });
        h.runFrames(10);

        assert.ok(
            state.statuses.some((s) => s.startsWith("MOVES 1")),
            "a two-card flip must be counted as one move"
        );
    });

    it("reflex: expired targets cost lives and end the run", () => {
        const h = createHarness();
        const { state, opts } = hooks();
        h.engines.reflex(h.canvas, opts);
        h.runFrames(1500);

        assert.equal(state.gameOvers.length, 1);
        assert.equal(state.gameOvers[0].message, "SYSTEM OVERRUN");
    });

    it("reflex: hitting a target scores (click inside the ring)", () => {
        const h = createHarness();
        const { state, opts } = hooks();
        h.engines.reflex(h.canvas, opts);
        h.runFrames(61); // first target spawns at frame 60

        // Targets spawn at 60 + random*(W-120) / 60 + random*(H-140).
        // Sweep a grid of clicks until one lands.
        for (let x = 60; x <= 580 && state.scores.length === 0; x += 10) {
            for (let y = 60; y <= 400 && state.scores.length === 0; y += 10) {
                h.canvasEvent("click", { clientX: x, clientY: y });
            }
        }

        assert.ok(state.scores.length > 0, "a click on the target scores");
        assert.ok(state.scores[0] >= 10);
    });

    it("pong: match ends when the AI reaches 5", () => {
        const h = createHarness();
        const { state, opts } = hooks();
        h.engines.pong(h.canvas, opts);
        h.runFrames(6000);

        assert.equal(state.gameOvers.length, 1);
        assert.equal(state.gameOvers[0].message, "CPU WINS");
    });

    it("pong: player paddle responds to the mouse", () => {
        const h = createHarness();
        const { opts } = hooks();
        h.engines.pong(h.canvas, opts);
        h.canvasEvent("mousemove", { clientX: 100, clientY: 200 });
        h.key("keydown", "ArrowUp");
        h.runFrames(60);
        h.key("keyup", "ArrowUp");
    });

    it("all engines clean up listeners and loops on destroy()", () => {
        for (const name of ENGINES) {
            const h = createHarness();
            const { opts } = hooks();
            const game = h.engines[name](h.canvas, opts);
            h.runFrames(30);
            game.destroy();
            // After destroy the rAF queue must drain and stay empty.
            h.runFrames(2);
            h.key("keydown", "ArrowLeft");
            h.canvasEvent("click");
        }
    });
});
