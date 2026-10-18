"use strict";

/* =========================================================
   GameHub live background
   ---------------------------------------------------------
   A parallax starfield (pixel-square stars, 3 depth layers
   drifting left), neon pixel particles rising from the
   bottom, and an occasional shooting star. Zero dependencies,
   one canvas, devicePixelRatio-aware, resize-safe, and it
   never runs for visitors with prefers-reduced-motion.

   Performance notes:
   - requestAnimationFrame only (browser pauses it on hidden
     tabs, so no manual battery management is needed)
   - O(stars + particles) per frame (~100-200 draw calls)
   - stars/particles are recreated (not resized) on resize
   ========================================================= */

(function () {
    // Respect the user's motion preference before touching the DOM.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        return;
    }

    const canvas = document.createElement("canvas");
    canvas.id = "bg-canvas";
    canvas.setAttribute("aria-hidden", "true");
    document.body.appendChild(canvas);
    const ctx = canvas.getContext("2d");

    let width = 0;
    let height = 0;

    const PARTICLE_COLORS = ["#00f5ff", "#ff00ff", "#36ff8a", "#ffd166"];

    let stars = [];
    let particles = [];
    let shooting = null;

    function rand(min, max) {
        return min + Math.random() * (max - min);
    }

    function resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function spawnStars() {
        stars = [];
        const count = Math.min(240, Math.floor((width * height) / 9000));
        for (let i = 0; i < count; i++) {
            stars.push({
                x: rand(0, width),
                y: rand(0, height),
                size: rand(0.6, 2),
                layer: i % 3, // 0 = far/slow, 2 = near/fast
                phase: rand(0, Math.PI * 2) // twinkle offset
            });
        }
    }

    function spawnParticles() {
        particles = [];
        const count = Math.max(12, Math.floor(width / 110));
        for (let i = 0; i < count; i++) {
            particles.push({
                x: rand(0, width),
                y: rand(0, height),
                size: rand(2, 5),
                speed: rand(0.15, 0.6), // rising
                drift: rand(-0.2, 0.2),
                color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
                alpha: rand(0.12, 0.45),
                spin: rand(0, Math.PI),
                spinSpeed: rand(-0.015, 0.015)
            });
        }
    }

    function maybeShoot() {
        if (shooting || Math.random() > 0.006) {
            return;
        }
        shooting = {
            x: rand(width * 0.3, width * 0.95),
            y: rand(0, height * 0.35),
            vx: -rand(5, 8),
            vy: rand(2, 4),
            life: 1
        };
    }

    function draw() {
        ctx.clearRect(0, 0, width, height);

        // --- stars: 3 parallax layers, drifting left, twinkling
        for (const star of stars) {
            star.x -= 0.05 + star.layer * 0.08;
            if (star.x < -2) {
                star.x = width + 2;
                star.y = rand(0, height);
            }
            star.phase += 0.03 + star.layer * 0.01;
            ctx.globalAlpha =
                0.35 + 0.5 * Math.abs(Math.sin(star.phase));
            ctx.fillStyle =
                star.layer === 2 ? "#00f5ff" : "#ffffff";
            // pixel squares, not circles — retro and cheap
            ctx.fillRect(star.x, star.y, star.size, star.size);
        }

        // --- neon pixel particles rising
        for (const p of particles) {
            p.y -= p.speed;
            p.x += p.drift;
            p.spin += p.spinSpeed;
            if (p.y < -8) {
                p.y = height + 8;
                p.x = rand(0, width);
            }
            ctx.globalAlpha = p.alpha;
            ctx.fillStyle = p.color;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.spin);
            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
            ctx.restore();
        }

        // --- shooting star (rare, short, subtle)
        maybeShoot();
        if (shooting) {
            shooting.x += shooting.vx;
            shooting.y += shooting.vy;
            shooting.life -= 0.012;
            if (shooting.life <= 0 || shooting.x < -150) {
                shooting = null;
            } else {
                const tailX = shooting.x - shooting.vx * 14;
                const tailY = shooting.y - shooting.vy * 14;
                const gradient = ctx.createLinearGradient(
                    shooting.x,
                    shooting.y,
                    tailX,
                    tailY
                );
                gradient.addColorStop(
                    0,
                    `rgba(255, 255, 255, ${shooting.life})`
                );
                gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
                ctx.globalAlpha = 1;
                ctx.strokeStyle = gradient;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(shooting.x, shooting.y);
                ctx.lineTo(tailX, tailY);
                ctx.stroke();
            }
        }

        ctx.globalAlpha = 1;
        window.requestAnimationFrame(draw);
    }

    let resizeTimer = null;
    window.addEventListener("resize", function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function () {
            resize();
            spawnStars();
            spawnParticles();
        }, 150);
    });

    resize();
    spawnStars();
    spawnParticles();
    window.requestAnimationFrame(draw);
})();
