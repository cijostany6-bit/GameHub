"use strict";

/* =========================================================
   GameHub game engines
   ---------------------------------------------------------
   Six complete, dependency-free canvas games. Every catalogue
   title in the database maps to one of these via ENGINE_MAP
   in play.js (contract: game names are unique — enforced by
   an integration test).

   Shared contract — each factory:
     create(canvas, opts) -> { destroy() }
   opts:
     colors    { accent, accent2, danger, surface, muted }
     onScore(n)             current score changed
     onStatus(text)         HUD status line changed
     onGameOver(score, msg) terminal state; runner shows overlay
   The engine owns its rAF loop and all input listeners;
   destroy() must remove them (engines are restarted in place
   by "Play again" without reloading the page).

   Canvas is a fixed 640x480 logical surface; CSS scales it.
   ========================================================= */

(function () {
    const W = 640;
    const H = 480;

    // --- shared helpers -------------------------------------------------
    function makeBinder() {
        const cleanups = [];
        return {
            on(target, event, fn) {
                target.addEventListener(event, fn);
                cleanups.push(() => target.removeEventListener(event, fn));
            },
            all() {
                cleanups.forEach((fn) => fn());
            }
        };
    }

    function fillBackground(ctx, colors) {
        ctx.fillStyle = colors.surface;
        ctx.fillRect(0, 0, W, H);
    }

    // =====================================================
    // SNAKE — grid crawler (Void Hunters, Cipher State)
    // =====================================================
    function createSnake(canvas, opts) {
        const ctx = canvas.getContext("2d");
        const bind = makeBinder();
        const CELL = 20;
        const COLS = W / CELL;
        const ROWS = H / CELL;

        let snake = [
            { x: 8, y: 12 },
            { x: 7, y: 12 },
            { x: 6, y: 12 }
        ];
        let dir = { x: 1, y: 0 };
        const dirQueue = [];
        let food = spawnFood();
        let score = 0;
        let tick = 0;
        let frame = 0;
        let alive = true;

        function spawnFood() {
            let spot;
            do {
                spot = {
                    x: Math.floor(Math.random() * COLS),
                    y: Math.floor(Math.random() * ROWS)
                };
            } while (snake.some((s) => s.x === spot.x && s.y === spot.y));
            return spot;
        }

        bind.on(window, "keydown", (event) => {
            const map = {
                ArrowUp: { x: 0, y: -1 },
                ArrowDown: { x: 0, y: 1 },
                ArrowLeft: { x: -1, y: 0 },
                ArrowRight: { x: 1, y: 0 },
                w: { x: 0, y: -1 },
                s: { x: 0, y: 1 },
                a: { x: -1, y: 0 },
                d: { x: 1, y: 0 }
            };
            const next = map[event.key] || map[event.key.toLowerCase?.()];
            if (next) {
                event.preventDefault();
                dirQueue.push(next);
            }
        });

        function step() {
            if (dirQueue.length > 0) {
                const candidate = dirQueue.shift();
                if (candidate.x !== -dir.x || candidate.y !== -dir.y) {
                    dir = candidate;
                }
            }
            const head = {
                x: snake[0].x + dir.x,
                y: snake[0].y + dir.y
            };

            if (
                head.x < 0 || head.x >= COLS ||
                head.y < 0 || head.y >= ROWS ||
                snake.some((s) => s.x === head.x && s.y === head.y)
            ) {
                alive = false;
                opts.onGameOver(score, "GAME OVER");
                return;
            }

            snake.unshift(head);
            if (head.x === food.x && head.y === food.y) {
                score += 10;
                opts.onScore(score);
                food = spawnFood();
            } else {
                snake.pop();
            }
        }

        function draw() {
            fillBackground(ctx, opts.colors);

            // faint grid dots
            ctx.fillStyle = opts.colors.muted;
            ctx.globalAlpha = 0.25;
            for (let x = 0; x < COLS; x++) {
                for (let y = 0; y < ROWS; y++) {
                    ctx.fillRect(x * CELL + CELL / 2, y * CELL + CELL / 2, 1, 1);
                }
            }
            ctx.globalAlpha = 1;

            // food — pulsing square
            const pulse = 6 + Math.sin(frame / 8) * 2;
            ctx.fillStyle = opts.colors.accent2;
            ctx.fillRect(
                food.x * CELL + (CELL - pulse) / 2,
                food.y * CELL + (CELL - pulse) / 2,
                pulse,
                pulse
            );

            // snake — head bright, body fades
            snake.forEach((segment, index) => {
                ctx.fillStyle = index === 0
                    ? "#ffffff"
                    : opts.colors.accent;
                ctx.globalAlpha = index === 0 ? 1 : Math.max(0.4, 1 - index * 0.03);
                ctx.fillRect(
                    segment.x * CELL + 1,
                    segment.y * CELL + 1,
                    CELL - 2,
                    CELL - 2
                );
            });
            ctx.globalAlpha = 1;
        }

        function loop() {
            frame++;
            if (alive) {
                // speed ramps with score (tick 8 -> 5)
                const speed = Math.max(5, 8 - Math.floor(score / 100));
                if (frame % speed === 0) {
                    tick++;
                    step();
                }
                draw();
            }
            raf = window.requestAnimationFrame(loop);
        }

        let raf = window.requestAnimationFrame(loop);
        opts.onStatus("SCORE " + score);

        return {
            destroy() {
                window.cancelAnimationFrame(raf);
                bind.all();
            }
        };
    }

    // =====================================================
    // BREAKOUT — paddle & bricks (Plasma Siege, Rift Breakers)
    // =====================================================
    function createBreakout(canvas, opts) {
        const ctx = canvas.getContext("2d");
        const bind = makeBinder();

        const PADDLE_W = 96;
        const PADDLE_H = 14;
        const PADDLE_Y = H - 26;
        const BALL_R = 6;

        const bricks = [];
        const ROWS = 4;
        const COLS = 8;
        const MARGIN_X = 16;
        const GAP = 4;
        const BRICK_W = (W - MARGIN_X * 2 - GAP * (COLS - 1)) / COLS;
        const BRICK_H = 18;
        let bricksLeft = ROWS * COLS;

        for (let row = 0; row < ROWS; row++) {
            for (let col = 0; col < COLS; col++) {
                bricks.push({
                    x: MARGIN_X + col * (BRICK_W + GAP),
                    y: 40 + row * (BRICK_H + GAP),
                    alive: true,
                    row
                });
            }
        }

        let paddleX = (W - PADDLE_W) / 2;
        let ball = { x: W / 2, y: PADDLE_Y - BALL_R - 1, vx: 0, vy: 0, stuck: true };
        let score = 0;
        let lives = 3;
        let speed = 4.5;
        let alive = true;

        bind.on(canvas, "mousemove", (event) => {
            const rect = canvas.getBoundingClientRect();
            const scale = W / rect.width;
            paddleX = (event.clientX - rect.left) * scale - PADDLE_W / 2;
            clampPaddle();
        });
        bind.on(window, "keydown", (event) => {
            if (event.key === "ArrowLeft" || event.key === "a") {
                paddleX -= 24;
                clampPaddle();
            }
            if (event.key === "ArrowRight" || event.key === "d") {
                paddleX += 24;
                clampPaddle();
            }
            if ((event.key === " " || event.key === "Enter") && ball.stuck) {
                launch();
            }
        });
        bind.on(canvas, "click", () => {
            if (ball.stuck) launch();
        });

        function clampPaddle() {
            paddleX = Math.max(0, Math.min(W - PADDLE_W, paddleX));
        }

        function launch() {
            ball.stuck = false;
            ball.vx = speed * (Math.random() < 0.5 ? -1 : 1) * 0.7;
            ball.vy = -speed;
            opts.onStatus("LIVES " + lives);
        }

        function loseLife() {
            lives--;
            if (lives <= 0) {
                alive = false;
                opts.onGameOver(score, "GAME OVER");
                return;
            }
            ball.stuck = true;
            ball.x = W / 2;
            ball.y = PADDLE_Y - BALL_R - 1;
            ball.vx = 0;
            ball.vy = 0;
            opts.onStatus("LIVES " + lives + " — PRESS SPACE");
        }

        function update() {
            if (ball.stuck) {
                ball.x = paddleX + PADDLE_W / 2;
                ball.y = PADDLE_Y - BALL_R - 1;
                return;
            }

            ball.x += ball.vx;
            ball.y += ball.vy;

            if (ball.x < BALL_R || ball.x > W - BALL_R) {
                ball.vx *= -1;
            }
            if (ball.y < BALL_R) {
                ball.vy *= -1;
            }

            // paddle
            if (
                ball.vy > 0 &&
                ball.y + BALL_R >= PADDLE_Y &&
                ball.y + BALL_R <= PADDLE_Y + PADDLE_H + 8 &&
                ball.x >= paddleX &&
                ball.x <= paddleX + PADDLE_W
            ) {
                const offset =
                    (ball.x - (paddleX + PADDLE_W / 2)) / (PADDLE_W / 2);
                let vx = speed * offset * 1.1;
                // A dead-centre hit would set vx = 0 and the ball would
                // bounce vertically forever on a stationary paddle —
                // an unwinnable stall. Guarantee a minimum angle.
                const minVx = speed * 0.25;
                if (Math.abs(vx) < minVx) {
                    vx = minVx * (ball.vx < 0 ? -1 : 1);
                }
                ball.vx = vx;
                ball.vy = -Math.abs(ball.vy);
                speed = Math.min(9, speed * 1.03); // gentle ramp
            }

            if (ball.y > H) {
                loseLife();
                return;
            }

            // bricks
            for (const brick of bricks) {
                if (
                    brick.alive &&
                    ball.x + BALL_R > brick.x &&
                    ball.x - BALL_R < brick.x + BRICK_W &&
                    ball.y + BALL_R > brick.y &&
                    ball.y - BALL_R < brick.y + BRICK_H
                ) {
                    brick.alive = false;
                    bricksLeft--;
                    score += 10;
                    opts.onScore(score);
                    ball.vy *= -1;
                    if (bricksLeft === 0) {
                        alive = false;
                        opts.onGameOver(score, "BOARD CLEARED!");
                    }
                    break;
                }
            }
        }

        function draw() {
            fillBackground(ctx, opts.colors);

            // bricks — row tinting between accent and accent2
            for (const brick of bricks) {
                if (!brick.alive) continue;
                ctx.globalAlpha = 1 - brick.row * 0.18;
                ctx.fillStyle = brick.row % 2 === 0
                    ? opts.colors.accent
                    : opts.colors.accent2;
                ctx.fillRect(brick.x, brick.y, BRICK_W, BRICK_H);
            }
            ctx.globalAlpha = 1;

            // paddle
            ctx.fillStyle = opts.colors.accent;
            ctx.fillRect(paddleX, PADDLE_Y, PADDLE_W, PADDLE_H);

            // ball
            ctx.fillStyle = "#ffffff";
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
            ctx.fill();

            if (ball.stuck && alive) {
                ctx.fillStyle = opts.colors.muted;
                ctx.font = "10px monospace";
                ctx.textAlign = "center";
                ctx.fillText("PRESS SPACE OR CLICK", W / 2, H / 2);
            }
        }

        function loop() {
            if (alive) {
                update();
                draw();
            }
            raf = window.requestAnimationFrame(loop);
        }

        let raf = window.requestAnimationFrame(loop);
        opts.onStatus("LIVES 3 — PRESS SPACE");

        return {
            destroy() {
                window.cancelAnimationFrame(raf);
                bind.all();
            }
        };
    }

    // =====================================================
    // DODGE — survival racing (Neon Rivals, Turbo Drift Zero)
    // =====================================================
    function createDodge(canvas, opts) {
        const ctx = canvas.getContext("2d");
        const bind = makeBinder();

        const PLAYER_W = 26;
        const PLAYER_H = 46;
        const PLAYER_Y = H - 70;

        let playerX = (W - PLAYER_W) / 2;
        let obstacles = [];
        let score = 0;
        let frame = 0;
        let alive = true;
        const held = new Set();

        bind.on(window, "keydown", (event) => {
            if (["ArrowLeft", "ArrowRight", "a", "d"].includes(event.key)) {
                event.preventDefault();
                held.add(event.key);
            }
        });
        bind.on(window, "keyup", (event) => held.delete(event.key));
        bind.on(canvas, "mousemove", (event) => {
            const rect = canvas.getBoundingClientRect();
            const scale = W / rect.width;
            playerX = (event.clientX - rect.left) * scale - PLAYER_W / 2;
            clamp();
        });

        function clamp() {
            playerX = Math.max(0, Math.min(W - PLAYER_W, playerX));
        }

        function obstacleSpeed() {
            return 3 + Math.min(7, frame / 600);
        }

        function update() {
            frame++;

            if (held.has("ArrowLeft") || held.has("a")) playerX -= 7;
            if (held.has("ArrowRight") || held.has("d")) playerX += 7;
            clamp();

            // spawn: interval shrinks with survival time
            const interval = Math.max(22, 55 - Math.floor(frame / 240));
            if (frame % interval === 0) {
                obstacles.push({
                    x: Math.random() * (W - PLAYER_W),
                    y: -PLAYER_H,
                    w: PLAYER_W + 4,
                    h: PLAYER_H + 8
                });
            }

            const v = obstacleSpeed();
            for (const obstacle of obstacles) {
                obstacle.y += v;
            }
            obstacles = obstacles.filter((o) => o.y < H + 60);

            // score: survival distance
            if (frame % 6 === 0) {
                score += 1;
                opts.onScore(score);
            }
            if (frame % 30 === 0) {
                opts.onStatus("SPEED x" + (1 + Math.floor(frame / 600)));
            }

            // collision
            const px = playerX + 3;
            const py = PLAYER_Y + 3;
            const pw = PLAYER_W - 6;
            const ph = PLAYER_H - 6;
            for (const obstacle of obstacles) {
                if (
                    px < obstacle.x + obstacle.w &&
                    px + pw > obstacle.x &&
                    py < obstacle.y + obstacle.h &&
                    py + ph > obstacle.y
                ) {
                    alive = false;
                    opts.onGameOver(score, "CRASHED!");
                    return;
                }
            }
        }

        function draw() {
            fillBackground(ctx, opts.colors);

            // scrolling road dashes (speed feedback)
            ctx.fillStyle = opts.colors.muted;
            ctx.globalAlpha = 0.5;
            const dashOffset = (frame * obstacleSpeed()) % 60;
            for (let x = 80; x < W; x += 160) {
                for (let y = -60; y < H; y += 60) {
                    ctx.fillRect(x, y + dashOffset, 4, 26);
                }
            }
            ctx.globalAlpha = 1;

            // obstacles — danger blocks with a "rear light" strip
            for (const obstacle of obstacles) {
                ctx.fillStyle = opts.colors.danger;
                ctx.fillRect(obstacle.x, obstacle.y, obstacle.w, obstacle.h);
                ctx.fillStyle = "#000000";
                ctx.globalAlpha = 0.35;
                ctx.fillRect(
                    obstacle.x + 4,
                    obstacle.y + obstacle.h - 8,
                    obstacle.w - 8,
                    4
                );
                ctx.globalAlpha = 1;
            }

            // player — accent car
            ctx.fillStyle = opts.colors.accent;
            ctx.fillRect(playerX, PLAYER_Y, PLAYER_W, PLAYER_H);
            ctx.fillStyle = "#070812";
            ctx.fillRect(
                playerX + 5,
                PLAYER_Y + 8,
                PLAYER_W - 10,
                PLAYER_H - 22
            );
        }

        function loop() {
            if (alive) {
                update();
                draw();
            }
            raf = window.requestAnimationFrame(loop);
        }

        let raf = window.requestAnimationFrame(loop);
        opts.onStatus("SPEED x1");

        return {
            destroy() {
                window.cancelAnimationFrame(raf);
                bind.all();
            }
        };
    }

    // =====================================================
    // MEMORY — match the pairs (Shadow Protocol, Iron Dominion)
    // =====================================================
    function createMemory(canvas, opts) {
        const ctx = canvas.getContext("2d");
        const bind = makeBinder();

        const SIZE = 4;
        const CARD_W = 96;
        const CARD_H = 90;
        const GAP = 8;
        const GRID_W = SIZE * CARD_W + (SIZE - 1) * GAP;
        const GRID_H = SIZE * CARD_H + (SIZE - 1) * GAP;
        const START_X = (W - GRID_W) / 2;
        const START_Y = (H - GRID_H) / 2;

        const PALETTE = ["#00f5ff", "#ff00ff", "#36ff8a", "#ffd166",
            "#7b5cff", "#ff5c7a", "#4dd0e1", "#c6ff00"];

        const deck = [];
        for (let i = 0; i < 8; i++) {
            deck.push(i, i);
        }
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }

        const cards = deck.map((icon, index) => ({
            icon,
            col: index % SIZE,
            row: Math.floor(index / SIZE),
            state: "down", // down | up | matched
            flip: 0 // animation timer
        }));

        let selection = [];
        let lock = false;
        let hideTimer = 0;
        let moves = 0;
        let matched = 0;
        let score = 0;
        let alive = true;

        bind.on(canvas, "click", (event) => {
            if (lock || !alive) return;
            const rect = canvas.getBoundingClientRect();
            const scale = W / rect.width;
            const x = (event.clientX - rect.left) * scale;
            const y = (event.clientY - rect.top) * scale;

            const card = cards.find((c) => {
                const cx = START_X + c.col * (CARD_W + GAP);
                const cy = START_Y + c.row * (CARD_H + GAP);
                return x >= cx && x <= cx + CARD_W &&
                    y >= cy && y <= cy + CARD_H;
            });

            if (!card || card.state !== "down") return;
            card.state = "up";
            selection.push(card);

            if (selection.length === 2) {
                moves++;
                opts.onStatus("MOVES " + moves);
                const [a, b] = selection;
                if (a.icon === b.icon) {
                    a.state = "matched";
                    b.state = "matched";
                    matched++;
                    score += 10;
                    opts.onScore(score);
                    selection = [];
                    if (matched === 8) {
                        alive = false;
                        opts.onGameOver(score, "ALL PAIRS FOUND!");
                    }
                } else {
                    lock = true;
                    hideTimer = 55;
                }
            }
        });

        function drawIcon(card) {
            const cx = START_X + card.col * (CARD_W + GAP) + CARD_W / 2;
            const cy = START_Y + card.row * (CARD_H + GAP) + CARD_H / 2;
            const color = PALETTE[card.icon];
            ctx.fillStyle = color;
            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
            const s = 20;
            switch (card.icon) {
                case 0: // circle
                    ctx.beginPath();
                    ctx.arc(cx, cy, s, 0, Math.PI * 2);
                    ctx.fill();
                    break;
                case 1: // square
                    ctx.fillRect(cx - s, cy - s, s * 2, s * 2);
                    break;
                case 2: // triangle
                    ctx.beginPath();
                    ctx.moveTo(cx, cy - s);
                    ctx.lineTo(cx + s, cy + s);
                    ctx.lineTo(cx - s, cy + s);
                    ctx.closePath();
                    ctx.fill();
                    break;
                case 3: // diamond
                    ctx.beginPath();
                    ctx.moveTo(cx, cy - s);
                    ctx.lineTo(cx + s, cy);
                    ctx.lineTo(cx, cy + s);
                    ctx.lineTo(cx - s, cy);
                    ctx.closePath();
                    ctx.fill();
                    break;
                case 4: // star (4-point)
                    ctx.beginPath();
                    ctx.moveTo(cx, cy - s);
                    ctx.lineTo(cx + 6, cy - 6);
                    ctx.lineTo(cx + s, cy);
                    ctx.lineTo(cx + 6, cy + 6);
                    ctx.lineTo(cx, cy + s);
                    ctx.lineTo(cx - 6, cy + 6);
                    ctx.lineTo(cx - s, cy);
                    ctx.lineTo(cx - 6, cy - 6);
                    ctx.closePath();
                    ctx.fill();
                    break;
                case 5: // cross
                    ctx.fillRect(cx - s, cy - 6, s * 2, 12);
                    ctx.fillRect(cx - 6, cy - s, 12, s * 2);
                    break;
                case 6: // ring
                    ctx.beginPath();
                    ctx.arc(cx, cy, s, 0, Math.PI * 2);
                    ctx.stroke();
                    break;
                default: // bars
                    for (let i = 0; i < 3; i++) {
                        ctx.fillRect(cx - s, cy - s + i * 16, s * 2, 8);
                    }
            }
        }

        function draw() {
            fillBackground(ctx, opts.colors);

            for (const card of cards) {
                const x = START_X + card.col * (CARD_W + GAP);
                const y = START_Y + card.row * (CARD_H + GAP);

                if (card.state === "down") {
                    ctx.fillStyle = opts.colors.surface;
                    ctx.fillRect(x, y, CARD_W, CARD_H);
                    ctx.strokeStyle = opts.colors.accent;
                    ctx.lineWidth = 2;
                    ctx.strokeRect(x + 1, y + 1, CARD_W - 2, CARD_H - 2);
                    // back pattern: dim accent tile
                    ctx.fillStyle = opts.colors.accent;
                    ctx.globalAlpha = 0.3;
                    ctx.fillRect(x + CARD_W / 2 - 8, y + CARD_H / 2 - 8, 16, 16);
                    ctx.globalAlpha = 1;
                } else {
                    ctx.fillStyle = card.state === "matched"
                        ? opts.colors.surface
                        : "#161a2e";
                    ctx.fillRect(x, y, CARD_W, CARD_H);
                    ctx.strokeStyle = card.state === "matched"
                        ? opts.colors.muted
                        : PALETTE[card.icon];
                    ctx.lineWidth = 2;
                    ctx.globalAlpha = card.state === "matched" ? 0.35 : 1;
                    ctx.strokeRect(x + 1, y + 1, CARD_W - 2, CARD_H - 2);
                    drawIcon(card);
                    ctx.globalAlpha = 1;
                }
            }
        }

        function loop() {
            if (lock && alive) {
                hideTimer--;
                if (hideTimer <= 0) {
                    selection.forEach((card) => {
                        card.state = "down";
                    });
                    selection = [];
                    lock = false;
                }
            }
            if (alive || matched === 8) draw();
            raf = window.requestAnimationFrame(loop);
        }

        let raf = window.requestAnimationFrame(loop);
        opts.onStatus("MOVES 0");

        return {
            destroy() {
                window.cancelAnimationFrame(raf);
                bind.all();
            }
        };
    }

    // =====================================================
    // REFLEX — click targets before they vanish
    // (Cyber Strike, Apex Circuit)
    // =====================================================
    function createReflex(canvas, opts) {
        const ctx = canvas.getContext("2d");
        const bind = makeBinder();

        let targets = [];
        let bursts = [];
        let score = 0;
        let lives = 3;
        let frame = 0;
        let combo = 0;
        let alive = true;

        bind.on(canvas, "click", (event) => {
            if (!alive) return;
            const rect = canvas.getBoundingClientRect();
            const scale = W / rect.width;
            const x = (event.clientX - rect.left) * scale;
            const y = (event.clientY - rect.top) * scale;

            for (let i = targets.length - 1; i >= 0; i--) {
                const target = targets[i];
                const dx = x - target.x;
                const dy = y - target.y;
                if (dx * dx + dy * dy <= target.r * target.r) {
                    targets.splice(i, 1);
                    combo++;
                    const precision = Math.round(
                        (target.life / target.maxLife) * 10
                    );
                    score += 10 + precision;
                    opts.onScore(score);
                    opts.onStatus("COMBO x" + combo);
                    bursts.push({ x: target.x, y: target.y, t: 12 });
                    return;
                }
            }
            // clicking empty space resets the combo (accuracy matters)
            combo = 0;
            opts.onStatus("COMBO x0");
        });

        function update() {
            frame++;

            // spawn interval shrinks with time; lifetime shrinks too
            const interval = Math.max(24, 60 - Math.floor(frame / 300));
            const life = Math.max(35, 80 - Math.floor(frame / 400));
            if (frame % interval === 0 && targets.length < 4) {
                targets.push({
                    x: 60 + Math.random() * (W - 120),
                    y: 60 + Math.random() * (H - 140),
                    r: 26,
                    life,
                    maxLife: life
                });
            }

            for (const target of targets) {
                target.life--;
            }
            const expired = targets.filter((t) => t.life <= 0);
            if (expired.length > 0) {
                targets = targets.filter((t) => t.life > 0);
                lives -= expired.length;
                combo = 0;
                if (lives <= 0) {
                    alive = false;
                    opts.onGameOver(score, "SYSTEM OVERRUN");
                    return;
                }
                opts.onStatus("LIVES " + lives + " — COMBO x0");
            }

            bursts = bursts.filter((burst) => --burst.t > 0);
        }

        function draw() {
            fillBackground(ctx, opts.colors);

            // crosshair grid
            ctx.strokeStyle = opts.colors.muted;
            ctx.globalAlpha = 0.15;
            ctx.lineWidth = 1;
            for (let x = 0; x <= W; x += 64) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, H);
                ctx.stroke();
            }
            for (let y = 0; y <= H; y += 64) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(W, y);
                ctx.stroke();
            }
            ctx.globalAlpha = 1;

            // targets: shrinking rings, danger color when almost gone
            for (const target of targets) {
                const ratio = target.life / target.maxLife;
                ctx.strokeStyle = ratio > 0.4
                    ? opts.colors.accent
                    : opts.colors.danger;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(target.x, target.y, target.r * ratio, 0, Math.PI * 2);
                ctx.stroke();
                ctx.fillStyle = ratio > 0.4
                    ? opts.colors.accent
                    : opts.colors.danger;
                ctx.globalAlpha = 0.25;
                ctx.beginPath();
                ctx.arc(target.x, target.y, target.r * ratio, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;
            }

            // hit bursts
            for (const burst of bursts) {
                ctx.strokeStyle = opts.colors.accent2;
                ctx.lineWidth = 2;
                ctx.globalAlpha = burst.t / 12;
                ctx.beginPath();
                ctx.arc(burst.x, burst.y, (12 - burst.t) * 3, 0, Math.PI * 2);
                ctx.stroke();
                ctx.globalAlpha = 1;
            }
        }

        function loop() {
            if (alive) {
                update();
                draw();
            }
            raf = window.requestAnimationFrame(loop);
        }

        let raf = window.requestAnimationFrame(loop);
        opts.onStatus("LIVES 3 — COMBO x0");

        return {
            destroy() {
                window.cancelAnimationFrame(raf);
                bind.all();
            }
        };
    }

    // =====================================================
    // PONG — duel the AI (Velocity Punk, Grid Commander)
    // =====================================================
    function createPong(canvas, opts) {
        const ctx = canvas.getContext("2d");
        const bind = makeBinder();

        const PADDLE_W = 12;
        const PADDLE_H = 80;
        const WIN_SCORE = 5;

        let playerY = (H - PADDLE_H) / 2;
        let aiY = (H - PADDLE_H) / 2;
        let ball = { x: W / 2, y: H / 2, vx: 0, vy: 0, r: 7 };
        let speed = 4.5;
        let playerPts = 0;
        let aiPts = 0;
        let serveTimer = 45;
        let alive = true;
        const held = new Set();

        bind.on(window, "keydown", (event) => {
            if (["ArrowUp", "ArrowDown", "w", "s"].includes(event.key)) {
                event.preventDefault();
                held.add(event.key);
            }
        });
        bind.on(window, "keyup", (event) => held.delete(event.key));
        bind.on(canvas, "mousemove", (event) => {
            const rect = canvas.getBoundingClientRect();
            const scale = H / rect.height;
            playerY = (event.clientY - rect.top) * scale - PADDLE_H / 2;
            clampPlayer();
        });

        function clampPlayer() {
            playerY = Math.max(0, Math.min(H - PADDLE_H, playerY));
        }

        function serve() {
            ball.x = W / 2;
            ball.y = H / 2;
            const angle = (Math.random() * 0.6 - 0.3) * Math.PI;
            ball.vx = speed * Math.cos(angle) * (Math.random() < 0.5 ? -1 : 1);
            ball.vy = speed * Math.sin(angle);
        }

        function point(player) {
            if (player) {
                playerPts++;
                opts.onScore(playerPts * 20);
            } else {
                aiPts++;
            }
            opts.onStatus("YOU " + playerPts + " — CPU " + aiPts);
            if (playerPts >= WIN_SCORE || aiPts >= WIN_SCORE) {
                alive = false;
                opts.onGameOver(
                    playerPts * 20,
                    playerPts >= WIN_SCORE ? "YOU WIN!" : "CPU WINS"
                );
                return;
            }
            speed = 4.5;
            serveTimer = 45;
            ball.x = W / 2;
            ball.y = H / 2;
            ball.vx = 0;
            ball.vy = 0;
        }

        function update() {
            if (held.has("ArrowUp") || held.has("w")) playerY -= 8;
            if (held.has("ArrowDown") || held.has("s")) playerY += 8;
            clampPlayer();

            if (serveTimer > 0) {
                serveTimer--;
                if (serveTimer === 0) serve();
                return;
            }

            ball.x += ball.vx;
            ball.y += ball.vy;

            if (ball.y < ball.r || ball.y > H - ball.r) {
                ball.vy *= -1;
            }

            // player paddle (left)
            if (
                ball.vx < 0 &&
                ball.x - ball.r <= 20 + PADDLE_W &&
                ball.x - ball.r >= 20 &&
                ball.y >= playerY &&
                ball.y <= playerY + PADDLE_H
            ) {
                const offset = (ball.y - (playerY + PADDLE_H / 2)) / (PADDLE_H / 2);
                speed = Math.min(10, speed * 1.05);
                ball.vx = Math.abs(speed * Math.cos(offset * 0.9));
                ball.vy = speed * Math.sin(offset * 0.9);
                ball.x = 20 + PADDLE_W + ball.r;
            }

            // AI paddle (right) — tracks with capped speed
            const aiSpeed = 4.2;
            const aiCenter = aiY + PADDLE_H / 2;
            if (ball.y < aiCenter - 6) aiY -= aiSpeed;
            if (ball.y > aiCenter + 6) aiY += aiSpeed;
            aiY = Math.max(0, Math.min(H - PADDLE_H, aiY));

            if (
                ball.vx > 0 &&
                ball.x + ball.r >= W - 20 - PADDLE_W &&
                ball.x + ball.r <= W - 20 + PADDLE_W &&
                ball.y >= aiY &&
                ball.y <= aiY + PADDLE_H
            ) {
                const offset = (ball.y - (aiY + PADDLE_H / 2)) / (PADDLE_H / 2);
                speed = Math.min(10, speed * 1.05);
                ball.vx = -Math.abs(speed * Math.cos(offset * 0.9));
                ball.vy = speed * Math.sin(offset * 0.9);
                ball.x = W - 20 - PADDLE_W - ball.r;
            }

            if (ball.x < -20) point(false);
            if (ball.x > W + 20) point(true);
        }

        function draw() {
            fillBackground(ctx, opts.colors);

            // center line
            ctx.fillStyle = opts.colors.muted;
            ctx.globalAlpha = 0.6;
            for (let y = 0; y < H; y += 24) {
                ctx.fillRect(W / 2 - 1, y, 2, 12);
            }
            ctx.globalAlpha = 1;

            // score
            ctx.font = "bold 40px monospace";
            ctx.textAlign = "center";
            ctx.fillStyle = opts.colors.muted;
            ctx.globalAlpha = 0.5;
            ctx.fillText(String(playerPts), W / 4, 52);
            ctx.fillText(String(aiPts), (3 * W) / 4, 52);
            ctx.globalAlpha = 1;

            // paddles + ball
            ctx.fillStyle = opts.colors.accent;
            ctx.fillRect(20, playerY, PADDLE_W, PADDLE_H);
            ctx.fillStyle = opts.colors.accent2;
            ctx.fillRect(W - 20 - PADDLE_W, aiY, PADDLE_W, PADDLE_H);
            ctx.fillStyle = "#ffffff";
            ctx.beginPath();
            ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
            ctx.fill();

            if (serveTimer > 0 && alive) {
                ctx.fillStyle = opts.colors.muted;
                ctx.font = "10px monospace";
                ctx.fillText("READY…", W / 2, H / 2 + 40);
            }
        }

        function loop() {
            if (alive) {
                update();
                draw();
            }
            raf = window.requestAnimationFrame(loop);
        }

        let raf = window.requestAnimationFrame(loop);
        opts.onStatus("YOU 0 — CPU 0");

        return {
            destroy() {
                window.cancelAnimationFrame(raf);
                bind.all();
            }
        };
    }

    // --- registry -------------------------------------------------------
    window.GameEngines = {
        snake: createSnake,
        breakout: createBreakout,
        dodge: createDodge,
        memory: createMemory,
        reflex: createReflex,
        pong: createPong
    };
})();
