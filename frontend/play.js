"use strict";

/* =========================================================
   GameHub play runner
   ---------------------------------------------------------
   play.html?id=<n>:
     1. fetch GET /api/games/:id          (404/error → honest state)
     2. dispatch the title to an engine    (ENGINE_MAP — names are a
        unique contract, enforced by an integration test)
     3. drive the shared HUD + overlay state machine:
        READY → PLAYING → GAME OVER → (PLAY AGAIN | BACK)
     4. persist the best score per title in localStorage
   ========================================================= */

(function () {
    // Title -> engine + player-facing controls. Every one of the
    // 12 catalogue entries is playable; nothing is a placeholder.
    const ENGINE_MAP = {
        "Cyber Strike": {
            engine: "reflex",
            controls: "Click the targets before they vanish — 3 lives. " +
                "Fast hits score more; clicking empty space drops your combo."
        },
        "Neon Rivals": {
            engine: "dodge",
            controls: "Arrow keys / A-D / mouse to steer. " +
                "Survive the traffic — distance is your score, speed ramps."
        },
        "Shadow Protocol": {
            engine: "memory",
            controls: "Click cards to flip two at a time. " +
                "Match all 8 pairs in as few moves as you can."
        },
        "Plasma Siege": {
            engine: "breakout",
            controls: "Mouse or arrow keys move the paddle. " +
                "Space/click launches — clear all 32 bricks on 3 lives."
        },
        "Turbo Drift Zero": {
            engine: "dodge",
            controls: "Arrow keys / A-D / mouse to steer. " +
                "Zero-gravity survival run — every metre counts."
        },
        "Iron Dominion": {
            engine: "memory",
            controls: "Click cards to flip two at a time. " +
                "Match all 8 pairs — supply lines reward memory."
        },
        "Void Hunters": {
            engine: "snake",
            controls: "Arrow keys or WASD to steer. " +
                "Collect bounties, never cross your own trail."
        },
        "Apex Circuit": {
            engine: "reflex",
            controls: "Click the apex markers before they close. " +
                "Accuracy keeps your combo — the league does not forgive."
        },
        "Cipher State": {
            engine: "snake",
            controls: "Arrow keys or WASD to traverse the network. " +
                "Grab the data nodes, avoid cutting your own connection."
        },
        "Rift Breakers": {
            engine: "breakout",
            controls: "Mouse or arrow keys move the paddle. " +
                "Space/click launches — smash through the rift wall."
        },
        "Velocity Punk": {
            engine: "pong",
            controls: "Mouse or W/S / arrow keys. " +
                "First to 5 beats the AI — every rally speeds up."
        },
        "Grid Commander": {
            engine: "pong",
            controls: "Mouse or W/S / arrow keys. " +
                "Hold the orbital line — first to 5 wins the skirmish."
        }
    };

    const CATEGORY_THEMES = {
        Action: { accent: "#00f5ff", accent2: "#ff00ff", danger: "#ff3355" },
        Racing: { accent: "#ffd166", accent2: "#ff5c7a", danger: "#ff3355" },
        Strategy: { accent: "#36ff8a", accent2: "#7b5cff", danger: "#ff3355" }
    };

    const SHARED_COLORS = { surface: "#101323", muted: "#9299b8" };

    const elements = {
        back: document.getElementById("back-link"),
        header: document.getElementById("play-header"),
        error: document.getElementById("play-error"),
        errorText: document.getElementById("error-text"),
        badge: document.getElementById("cat-badge"),
        title: document.getElementById("game-title"),
        description: document.getElementById("game-description"),
        canvas: document.getElementById("game-canvas"),
        overlay: document.getElementById("stage-overlay"),
        overlayTitle: document.getElementById("overlay-title"),
        overlaySub: document.getElementById("overlay-sub"),
        overlayPrimary: document.getElementById("overlay-primary"),
        overlayBack: document.getElementById("overlay-back"),
        hudScore: document.getElementById("hud-score"),
        hudBest: document.getElementById("hud-best"),
        hudStatus: document.getElementById("hud-status"),
        controls: document.getElementById("controls-hint"),
        engineName: document.getElementById("engine-name")
    };

    let activeGame = null;
    let bestKey = null;
    let currentScore = 0;

    function escapeText(value) {
        // textContent never parses markup — this is the XSS-safe setter.
        elements.title.textContent = value;
    }

    function showError(message) {
        elements.error.hidden = false;
        elements.header.hidden = true;
        elements.overlay.hidden = true;
        document.querySelector(".play-stage").hidden = true;
        document.querySelector(".hud-bar").hidden = true;
        document.querySelector(".controls-panel").hidden = true;
        elements.errorText.textContent = message;
        document.title = "GameHub | Game unavailable";
    }

    function readBest() {
        try {
            return parseInt(window.localStorage.getItem(bestKey) || "0", 10) || 0;
        } catch (_error) {
            return 0; // private mode / storage disabled
        }
    }

    function writeBest(value) {
        try {
            window.localStorage.setItem(bestKey, String(value));
        } catch (_error) {
            /* storage disabled — score just isn't remembered */
        }
    }

    function setScore(value) {
        currentScore = value;
        elements.hudScore.textContent = String(value).padStart(4, "0");
    }

    function setStatus(text) {
        elements.hudStatus.textContent = text;
    }

    function showOverlay(title, sub, primaryLabel, onPrimary) {
        elements.overlay.hidden = false;
        elements.overlayTitle.textContent = title;
        elements.overlaySub.textContent = sub;
        elements.overlayPrimary.textContent = primaryLabel;
        elements.overlayPrimary.onclick = onPrimary;
        elements.overlayBack.onclick = () => {
            window.location.href = "games.html";
        };
    }

    function hideOverlay() {
        elements.overlay.hidden = true;
    }

    function startEngine(gameData, mapping) {
        if (activeGame) {
            activeGame.destroy();
            activeGame = null;
        }
        setScore(0);
        setStatus("…");

        const colors = {
            ...SHARED_COLORS,
            ...CATEGORY_THEMES[gameData.category]
        };

        activeGame = window.GameEngines[mapping.engine](elements.canvas, {
            colors,
            onScore: setScore,
            onStatus: setStatus,
            onGameOver(finalScore, message) {
                const best = Math.max(finalScore, readBest());
                if (best > readBest()) writeBest(best);
                elements.hudBest.textContent = String(best).padStart(4, "0");
                showOverlay(
                    message,
                    `SCORE ${finalScore} — BEST ${best}`,
                    "PLAY AGAIN",
                    () => startEngine(gameData, mapping)
                );
            }
        });
    }

    async function init() {
        const params = new URLSearchParams(window.location.search);
        const rawId = params.get("id");

        if (!rawId) {
            showError("No game selected — pick one from the catalogue.");
            return;
        }
        if (!/^\d+$/.test(rawId)) {
            showError("That is not a valid game id.");
            return;
        }

        let data;
        try {
            const response = await fetch(`/api/games/${rawId}`);
            if (response.status === 404) {
                showError("This game does not exist (yet).");
                return;
            }
            if (!response.ok) {
                showError("The game service is not reachable right now.");
                return;
            }
            data = await response.json();
        } catch (_error) {
            showError("The game service is not reachable right now.");
            return;
        }

        const mapping = ENGINE_MAP[data.name];
        if (!mapping || !window.GameEngines[mapping.engine]) {
            showError(`"${data.name}" has no engine assigned yet.`);
            return;
        }

        // --- populate the page -----------------------------------------
        escapeText(data.name);
        document.title = `GameHub | ${data.name}`;
        elements.description.textContent = data.description;
        elements.badge.textContent = data.category.toUpperCase();
        elements.badge.classList.add(`cat-${data.category.toLowerCase()}`);
        elements.controls.textContent = mapping.controls;
        elements.engineName.textContent =
            `Engine: ${mapping.engine} — one of six built-in GameHub engines`;
        bestKey = `gamehub.best.${rawId}`;
        elements.hudBest.textContent = String(readBest()).padStart(4, "0");
        elements.header.hidden = false;
        document.querySelector(".play-stage").hidden = false;
        document.querySelector(".hud-bar").hidden = false;
        document.querySelector(".controls-panel").hidden = false;

        showOverlay(
            "READY?",
            mapping.controls,
            "START GAME",
            () => {
                hideOverlay();
                startEngine(data, mapping);
            }
        );
    }

    // Escape always returns to the catalogue (unless the page is
    // showing an error state — then the visible back link is enough).
    window.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && elements.error.hidden) {
            window.location.href = "games.html";
        }
    });

    init();
})();
