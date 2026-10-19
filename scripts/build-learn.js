#!/usr/bin/env node
"use strict";

/* =========================================================
 * GameHub — /learn static site + print guide generator
 *
 * Dependency-free (Node built-ins only, no npm, no network).
 *
 * Reads README.md + every docs/*.md and writes:
 *   learn/index.html            landing page (cards + PDF download)
 *   learn/<slug>.html           one page per document
 *   learn/guide.html            all documents, print-optimised (→ PDF)
 *   learn/style.css             arcade theme, self-hosted fonts only
 *   learn/fonts/*               woff2 + OFL licences copied from frontend/
 *
 * The Markdown renderer is hand-written so the project keeps its
 * "zero runtime dependencies, zero third-party requests" posture.
 * ========================================================= */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const DOCS_DIR = path.join(ROOT, "docs");
const OUT_DIR = path.join(ROOT, "learn");
const FONT_SRC = path.join(ROOT, "frontend", "fonts");
const FONT_DST = path.join(OUT_DIR, "fonts");

const PROJECT = {
  title: "GameHub",
  tagline: "A Futuristic Gaming Platform Built with AWS & DevOps",
  repo: "https://github.com/cijostany6-bit/GameHub",
  live: "https://gamehub.worldofvpc.online",
  pdf: "gamehub-guide.pdf",
};

/* ---------------------------------------------------------
 * small helpers
 * ------------------------------------------------------- */

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function stripInline(s) {
  return String(s)
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\*\*([^*]*)\*\*/g, "$1")
    .replace(/\*([^*]*)\*/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_]/g, "");
}

/* ---------------------------------------------------------
 * Markdown → HTML
 * ------------------------------------------------------- */

const INLINE_RE = new RegExp(
  [
    String.raw`(?<img>!\[(?<imgalt>[^\]]*)\]\((?<imgsrc>[^)\s]+)(?:\s+"[^"]*")?\))`,
    String.raw`(?<link>\[(?<linktext>[^\]]*)\]\((?<linkhref>[^)\s]+)(?:\s+"[^"]*")?\))`,
    String.raw`(?<auto>&lt;(?<autourl>(?:https?:|mailto:)[^&\s]+)&gt;)`,
    String.raw`(?<b1>\*\*(?<b1t>[^*]+)\*\*)`,
    String.raw`(?<b2>__(?<b2t>[^_]+)__)`,
    String.raw`(?<i1>\*(?<i1t>[^*]+)\*)`,
    String.raw`(?<i2>(?<![A-Za-z0-9])_(?<i2t>[^_]+)_(?![A-Za-z0-9]))`,
    String.raw`(?<st>~~(?<stt>[^~]+)~~)`,
  ].join("|"),
  "g"
);

/* Remote images (the README's shields.io/CI badges) are rendered as inert text
 * chips: the /learn site must make ZERO third-party requests — same GDPR
 * reasoning that made the app self-host its fonts in Phase 2. Local images are
 * emitted as real <img> tags. */
function renderImage(src, alt) {
  if (/^https?:/i.test(src)) {
    return `<span class="ext-img" title="${escapeHtml(src)}">${escapeHtml(alt)}</span>`;
  }
  return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy" />`;
}

/* Inline markdown for text that has ALREADY been HTML-escaped.
 * Code spans must be protected by the caller (see inline()). */
function inlineFromEscaped(text) {
  return text.replace(INLINE_RE, (match, ...rest) => {
    const g = rest[rest.length - 1];
    if (g.img !== undefined) {
      return renderImage(g.imgsrc, g.imgalt);
    }
    if (g.link !== undefined) {
      return `<a href="${g.linkhref}">${inlineFromEscaped(g.linktext)}</a>`;
    }
    if (g.auto !== undefined) {
      return `<a href="${g.autourl}">${g.autourl}</a>`;
    }
    if (g.b1 !== undefined) return `<strong>${inlineFromEscaped(g.b1t)}</strong>`;
    if (g.b2 !== undefined) return `<strong>${inlineFromEscaped(g.b2t)}</strong>`;
    if (g.i1 !== undefined) return `<em>${inlineFromEscaped(g.i1t)}</em>`;
    if (g.i2 !== undefined) return `<em>${inlineFromEscaped(g.i2t)}</em>`;
    if (g.st !== undefined) return `<del>${inlineFromEscaped(g.stt)}</del>`;
    return match;
  });
}

/* Full inline renderer: protects code spans and linked badge images, escapes,
 * then renders. Code spans and badges are stashed as placeholders so the inline
 * pass can never re-parse them (and escaping can never touch real HTML). */
const BADGE_RE = /\[!\[([^\]]*)\]\(([^)\s]+)\)\]\(([^)\s]+)\)/g;

function inline(raw) {
  const store = [];
  const ph = (value) => {
    store.push(value);
    return `\x01${store.length - 1}\x01`;
  };

  let text = String(raw).replace(/`([^`]+)`/g, (_m, code) => ph({ code }));
  text = text.replace(BADGE_RE, (_m, alt, src, href) =>
    ph({ html: `<a href="${escapeHtml(href)}">${renderImage(src, alt)}</a>` })
  );
  text = escapeHtml(text);
  text = inlineFromEscaped(text);
  return text.replace(/\x01(\d+)\x01/g, (_m, i) => {
    const s = store[+i];
    return s.code !== undefined ? `<code>${escapeHtml(s.code)}</code>` : s.html;
  });
}

const HEADING_RE = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const FENCE_RE = /^\s*(```|~~~)\s*([\w+#-]*)\s*$/;
const HR_RE = /^\s*(-{3,}|\*{3,}|_{3,})\s*$/;
const QUOTE_RE = /^\s*>/;
const UL_RE = /^\s*[-*+]\s+/;
const OL_RE = /^\s*\d+\.\s+/;
const MARKER_RE = /^(\s*)(?:[-*+]|\d+\.)\s+/;

function indentOf(line) {
  return line.length - line.replace(/^\s*/, "").length;
}

function isMarker(line) {
  return MARKER_RE.test(line);
}

function isTableSeparator(line) {
  return line.includes("|") && /^[\s|:-]+$/.test(line) && line.includes("-");
}

function splitTableRow(line) {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  return s.split("|").map((c) => c.trim());
}

function alignOf(cell) {
  const left = cell.startsWith(":");
  const right = cell.endsWith(":");
  if (left && right) return "center";
  if (right) return "right";
  if (left) return "left";
  return "";
}

function parseTable(lines, i) {
  const header = splitTableRow(lines[i]);
  const align = splitTableRow(lines[i + 1]).map(alignOf);
  let j = i + 2;
  const rows = [];
  while (j < lines.length && lines[j].trim() !== "" && lines[j].includes("|")) {
    rows.push(splitTableRow(lines[j]));
    j++;
  }
  const cell = (tag, text, idx) => {
    const a = align[idx] ? ` style="text-align:${align[idx]}"` : "";
    return `<${tag}${a}>${inline(text)}</${tag}>`;
  };
  let html = "<div class=\"table-wrap\"><table><thead><tr>";
  header.forEach((c, idx) => (html += cell("th", c, idx)));
  html += "</tr></thead><tbody>";
  for (const row of rows) {
    html += "<tr>";
    for (let idx = 0; idx < header.length; idx++) {
      html += cell("td", row[idx] === undefined ? "" : row[idx], idx);
    }
    html += "</tr>";
  }
  html += "</tbody></table></div>";
  return { html, next: j };
}

/* Unordered / ordered lists, with nested lists via indentation. */
function parseList(lines, i0) {
  const base = indentOf(lines[i0]);
  const ordered = OL_RE.test(lines[i0]);
  let html = ordered ? "<ol>" : "<ul>";
  let i = i0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") {
      let j = i + 1;
      while (j < lines.length && lines[j].trim() === "") j++;
      if (j < lines.length && indentOf(lines[j]) === base && isMarker(lines[j])) {
        i = j;
        continue;
      }
      break;
    }
    if (indentOf(line) !== base || !isMarker(line)) break;

    let content = line.replace(MARKER_RE, "");
    // GitHub-style task list checkboxes.
    content = content.replace(/^\[([ xX])\]\s+/, (_m, c) => (c === " " ? "☐ " : "☑ "));

    // Gather this item's continuation lines (deeper indentation).
    let i2 = i + 1;
    const child = [];
    while (i2 < lines.length) {
      const l = lines[i2];
      if (l.trim() === "") {
        let j = i2 + 1;
        while (j < lines.length && lines[j].trim() === "") j++;
        if (j < lines.length && indentOf(lines[j]) > base) {
          child.push("");
          i2 = j;
          continue;
        }
        break;
      }
      if (indentOf(l) > base) {
        child.push(l.slice(base + 2));
        i2++;
        continue;
      }
      break;
    }

    // The first run of non-blank, non-block lines is a lazy continuation of the
    // item's own paragraph (wrapped prose). Anything after that — a nested list,
    // a code fence, a quote — is rendered as a block inside the item.
    let ci = 0;
    while (ci < child.length) {
      const l = child[ci];
      if (l.trim() === "") break;
      if (isBlockStarter(child, ci)) break;
      content += " " + l.trim();
      ci++;
    }
    if (ci < child.length && child[ci].trim() === "") ci++;

    let childHtml = "";
    if (ci < child.length) childHtml = renderBlocks(child.slice(ci));
    html += `<li>${inline(content)}${childHtml}</li>`;
    i = i2;
  }
  html += ordered ? "</ol>" : "</ul>";
  return { html, next: i };
}

function startsNewBlock(lines, i) {
  if (lines[i].trim() === "") return true;
  return isBlockStarter(lines, i);
}

function isBlockStarter(lines, i) {
  const line = lines[i];
  if (FENCE_RE.test(line)) return true;
  if (HEADING_RE.test(line)) return true;
  if (HR_RE.test(line)) return true;
  if (QUOTE_RE.test(line)) return true;
  if (UL_RE.test(line) || OL_RE.test(line)) return true;
  if (line.includes("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1])) return true;
  return false;
}

function renderBlocks(lines) {
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i++;
      continue;
    }

    // fenced code block
    const fence = FENCE_RE.exec(line);
    if (fence) {
      const marker = fence[1];
      const lang = fence[2] || "";
      const closeRe = new RegExp("^\\s*" + marker + "\\s*$");
      const buf = [];
      i++;
      while (i < lines.length && !closeRe.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++;
      const cls = lang ? ` class="language-${escapeHtml(lang)}"` : "";
      out.push(`<pre><code${cls}>${escapeHtml(buf.join("\n"))}</code></pre>`);
      continue;
    }

    // heading
    const h = HEADING_RE.exec(line);
    if (h) {
      const lvl = h[1].length;
      const id = slugify(stripInline(h[2]));
      const idAttr = id ? ` id="${id}"` : "";
      out.push(`<h${lvl}${idAttr}>${inline(h[2])}</h${lvl}>`);
      i++;
      continue;
    }

    // horizontal rule
    if (HR_RE.test(line)) {
      out.push("<hr />");
      i++;
      continue;
    }

    // blockquote
    if (QUOTE_RE.test(line)) {
      const buf = [];
      while (i < lines.length && QUOTE_RE.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*>\s?/, ""));
        i++;
      }
      out.push(`<blockquote>${renderBlocks(buf)}</blockquote>`);
      continue;
    }

    // table
    if (line.includes("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const t = parseTable(lines, i);
      out.push(t.html);
      i = t.next;
      continue;
    }

    // list
    if (UL_RE.test(line) || OL_RE.test(line)) {
      const l = parseList(lines, i);
      out.push(l.html);
      i = l.next;
      continue;
    }

    // paragraph
    const buf = [line];
    i++;
    while (i < lines.length && !startsNewBlock(lines, i)) {
      buf.push(lines[i]);
      i++;
    }
    out.push(`<p>${inline(buf.join(" "))}</p>`);
  }
  return out.join("\n");
}

function renderMarkdown(md) {
  return renderBlocks(String(md).replace(/\r\n?/g, "\n").split("\n"));
}

/* ---------------------------------------------------------
 * document discovery
 * ------------------------------------------------------- */

function docKind(name, title) {
  if (name === "README.md") return "OVERVIEW";
  const m = /^step-(\d+)/i.exec(name);
  if (m) return `STEP ${parseInt(m[1], 10)}`;
  return "DOC";
}

function firstParagraph(md) {
  const lines = String(md).replace(/\r\n?/g, "\n").split("\n");
  let seenH1 = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (!seenH1) {
      if (/^#\s+/.test(line)) seenH1 = true;
      continue;
    }
    if (/^#{1,6}\s+/.test(line)) continue;
    if (/^[>|]/.test(line)) continue;
    if (/^```/.test(line)) continue;
    if (UL_RE.test(raw) || OL_RE.test(raw)) continue;
    return line;
  }
  return "";
}

function sortKey(name) {
  if (name === "README.md") return [0, ""];
  const m = /^step-(\d+)/i.exec(name);
  if (m) return [1, String(parseInt(m[1], 10)).padStart(4, "0")];
  return [2, name.toLowerCase()];
}

function loadDocuments() {
  const sources = [{ name: "README.md", file: path.join(ROOT, "README.md") }];
  for (const file of fs.readdirSync(DOCS_DIR).sort()) {
    if (!file.toLowerCase().endsWith(".md")) continue;
    sources.push({ name: file, file: path.join(DOCS_DIR, file) });
  }
  sources.sort((a, b) => {
    const ka = sortKey(a.name);
    const kb = sortKey(b.name);
    if (ka[0] !== kb[0]) return ka[0] - kb[0];
    return ka[1] < kb[1] ? -1 : ka[1] > kb[1] ? 1 : 0;
  });

  return sources.map((s) => {
    const md = fs.readFileSync(s.file, "utf8");
    const h1 = /^#\s+(.*)$/m.exec(md);
    const title = h1 ? h1[1].trim() : s.name;
    const navTitle = title.replace(/^[^\p{L}\p{N}]+/u, "").trim() || title;
    const slug = s.name === "README.md" ? "readme" : slugify(s.name.replace(/\.md$/i, ""));
    return {
      name: s.name,
      slug,
      title,
      navTitle,
      kind: docKind(s.name, title),
      source: path.relative(ROOT, s.file),
      html: renderMarkdown(md),
      blurb: firstParagraph(md),
    };
  });
}

/* ---------------------------------------------------------
 * presentation
 * ------------------------------------------------------- */

const SITE_CSS = `/* GameHub /learn — generated by scripts/build-learn.js. Do not edit by hand.
   Fonts are SELF-HOSTED (OFL, copied into fonts/) — no third-party requests,
   no Google Fonts: the project is GDPR-conscious. */

@font-face {
  font-family: "Press Start 2P";
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url("fonts/press-start-2p-latin-400.woff2") format("woff2");
}
@font-face {
  font-family: "Chakra Petch";
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url("fonts/chakra-petch-latin-400.woff2") format("woff2");
}
@font-face {
  font-family: "Chakra Petch";
  font-style: normal;
  font-weight: 600;
  font-display: swap;
  src: url("fonts/chakra-petch-latin-600.woff2") format("woff2");
}
@font-face {
  font-family: "Chakra Petch";
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url("fonts/chakra-petch-latin-700.woff2") format("woff2");
}

:root {
  --bg: #070812;
  --panel: #101323;
  --panel-2: #0b0d1a;
  --text: #f4f7ff;
  --muted: #9299b8;
  --cyan: #00f5ff;
  --purple: #9b5cff;
  --pink: #ff3cac;
  --border: rgba(255, 255, 255, 0.1);
  --sidebar-w: 288px;
}

* { box-sizing: border-box; }

html { scroll-behavior: smooth; }

body {
  margin: 0;
  min-height: 100vh;
  color: var(--text);
  background:
    radial-gradient(circle at 82% 8%, rgba(155, 92, 255, 0.16), transparent 32%),
    radial-gradient(circle at 8% 34%, rgba(0, 245, 255, 0.09), transparent 30%),
    var(--bg);
  font-family: "Chakra Petch", "Segoe UI", sans-serif;
  font-size: 17px;
  line-height: 1.7;
}

body::before {
  content: "";
  position: fixed;
  inset: 0;
  pointer-events: none;
  opacity: 0.1;
  z-index: 0;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
  background-size: 46px 46px;
  mask-image: linear-gradient(to bottom, black, transparent 80%);
}

a { color: var(--cyan); text-decoration: none; }
a:hover { text-decoration: underline; }

.skip-link {
  position: absolute;
  left: -9999px;
  top: 0;
}
.skip-link:focus {
  left: 12px;
  top: 12px;
  z-index: 20;
  padding: 10px 14px;
  background: var(--cyan);
  color: var(--bg);
  border-radius: 6px;
}

.layout {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: var(--sidebar-w) minmax(0, 1fr);
  gap: 0;
  max-width: 1440px;
  margin: 0 auto;
}

/* ---------------- sidebar ---------------- */

.sidebar {
  position: sticky;
  top: 0;
  align-self: start;
  height: 100vh;
  overflow-y: auto;
  padding: 30px 22px 40px;
  border-right: 1px solid var(--border);
  background: linear-gradient(180deg, rgba(16, 19, 35, 0.85), rgba(7, 8, 18, 0.85));
  backdrop-filter: blur(8px);
}

.brand {
  display: inline-block;
  font-family: "Press Start 2P", monospace;
  font-size: 0.9rem;
  letter-spacing: 1px;
  color: var(--text);
}
.brand span { color: var(--cyan); }
.brand:hover { text-decoration: none; }

.sidebar-sub {
  margin: 8px 0 22px;
  font-family: "Press Start 2P", monospace;
  font-size: 0.55rem;
  letter-spacing: 2px;
  color: var(--pink);
}

.nav ul { list-style: none; margin: 0; padding: 0; }
.nav li { margin-bottom: 6px; }

.nav a {
  display: block;
  padding: 9px 12px;
  border: 1px solid transparent;
  border-radius: 8px;
  color: var(--muted);
  font-size: 0.86rem;
  line-height: 1.35;
  transition: color 0.2s ease, border-color 0.2s ease, background 0.2s ease;
}
.nav a:hover {
  color: var(--text);
  border-color: var(--border);
  background: rgba(255, 255, 255, 0.03);
  text-decoration: none;
}
.nav a.is-active {
  color: var(--cyan);
  border-color: rgba(0, 245, 255, 0.4);
  background: rgba(0, 245, 255, 0.06);
}
.nav-kind {
  display: block;
  margin-bottom: 3px;
  font-family: "Press Start 2P", monospace;
  font-size: 0.44rem;
  letter-spacing: 1px;
  color: var(--purple);
}
.nav a.is-active .nav-kind { color: var(--cyan); }

.sidebar-foot {
  margin-top: 26px;
  padding-top: 22px;
  border-top: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.btn {
  display: inline-block;
  text-align: center;
  padding: 11px 14px;
  border-radius: 7px;
  font-family: "Press Start 2P", monospace;
  font-size: 0.56rem;
  letter-spacing: 1px;
  line-height: 1.6;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}
.btn:hover { text-decoration: none; transform: translateY(-2px); }
.btn-primary {
  color: #05060d;
  background: var(--cyan);
  box-shadow: 0 0 22px rgba(0, 245, 255, 0.25);
}
.btn-primary:hover { box-shadow: 0 0 32px rgba(0, 245, 255, 0.55); }
.btn-ghost {
  color: var(--text);
  border: 1px solid var(--border);
}
.btn-ghost:hover { border-color: var(--purple); }

/* ---------------- content ---------------- */

.content {
  padding: 46px clamp(20px, 5vw, 68px) 90px;
  min-width: 0;
}

.hero-eyebrow {
  font-family: "Press Start 2P", monospace;
  font-size: 0.6rem;
  letter-spacing: 3px;
  color: var(--cyan);
  margin: 0 0 14px;
}

.hero-title {
  font-family: "Chakra Petch", sans-serif;
  font-weight: 700;
  font-size: clamp(2.6rem, 6vw, 4.4rem);
  line-height: 1;
  letter-spacing: -2px;
  margin: 0 0 18px;
}
.hero-title span {
  display: block;
  color: transparent;
  -webkit-text-stroke: 1px var(--cyan);
  text-shadow: 0 0 30px rgba(0, 245, 255, 0.25);
}
.hero-lede { max-width: 62ch; color: var(--muted); margin: 0 0 26px; }

.hero-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 20px; }
.hero-actions .btn { padding: 13px 18px; font-size: 0.6rem; }

.doc-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  margin-bottom: 26px;
}
.chip {
  font-family: "Press Start 2P", monospace;
  font-size: 0.48rem;
  letter-spacing: 1px;
  padding: 7px 11px;
  border: 1px solid var(--border);
  border-radius: 5px;
  color: var(--muted);
}
.chip-source { color: var(--purple); border-color: rgba(155, 92, 255, 0.4); }

.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 18px;
  margin: 8px 0 0;
}

.card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 24px 22px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.012));
  transition: transform 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease;
}
.card:hover {
  transform: translateY(-6px);
  border-color: var(--cyan);
  box-shadow: 0 0 32px rgba(0, 245, 255, 0.13);
}
.card:hover a { text-decoration: none; }
.card-kind {
  font-family: "Press Start 2P", monospace;
  font-size: 0.5rem;
  letter-spacing: 2px;
  color: var(--pink);
}
.card h3 {
  margin: 0;
  font-family: "Chakra Petch", sans-serif;
  font-weight: 700;
  font-size: 1.2rem;
  line-height: 1.25;
  color: var(--text);
}
.card p { margin: 0; color: var(--muted); font-size: 0.88rem; line-height: 1.6; }
.card-open {
  margin-top: auto;
  font-family: "Press Start 2P", monospace;
  font-size: 0.5rem;
  letter-spacing: 1px;
  color: var(--cyan);
}

.section-band {
  margin: 54px 0 0;
  padding: 30px;
  border: 1px solid rgba(0, 245, 255, 0.18);
  border-radius: 18px;
  background: linear-gradient(135deg, rgba(0, 245, 255, 0.06), rgba(155, 92, 255, 0.05));
}
.section-band h2 {
  margin: 0 0 10px;
  font-family: "Chakra Petch", sans-serif;
  font-weight: 700;
  font-size: 1.6rem;
}
.section-band p { margin: 0 0 18px; color: var(--muted); max-width: 70ch; }

/* ---------------- rendered markdown ---------------- */

.md > *:first-child { margin-top: 0; }

.md h1, .md h2, .md h3, .md h4, .md h5, .md h6 {
  font-family: "Chakra Petch", sans-serif;
  font-weight: 700;
  line-height: 1.2;
  color: var(--text);
  scroll-margin-top: 20px;
}
.md h1 {
  font-size: clamp(2rem, 4.6vw, 3.2rem);
  letter-spacing: -1px;
  margin: 0 0 22px;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--border);
}
.md h2 {
  font-size: clamp(1.5rem, 3vw, 2.05rem);
  margin: 46px 0 16px;
  padding-left: 14px;
  border-left: 4px solid var(--cyan);
}
.md h3 { font-size: 1.3rem; margin: 32px 0 12px; color: var(--cyan); }
.md h4 { font-size: 1.08rem; margin: 26px 0 10px; }
.md p { margin: 0 0 18px; }
.md strong { color: #ffffff; }
.md em { color: #dfe4ff; }
.md del { color: var(--muted); }

.md a { border-bottom: 1px dashed rgba(0, 245, 255, 0.5); }
.md a:hover { border-bottom-style: solid; }

.md img { max-width: 100%; height: auto; vertical-align: middle; }

.md .ext-img {
  display: inline-block;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.72em;
  letter-spacing: 0.5px;
  padding: 2px 8px;
  margin: 2px 4px 2px 0;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--panel-2);
  color: var(--muted);
}

.md ul, .md ol { margin: 0 0 18px; padding-left: 26px; }
.md li { margin-bottom: 8px; }
.md li > ul, .md li > ol { margin-top: 8px; }

.md code {
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
  font-size: 0.86em;
  padding: 2px 6px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--panel-2);
  color: #ffd9f4;
}

.md pre {
  margin: 0 0 22px;
  padding: 18px 20px;
  overflow-x: auto;
  border: 1px solid var(--border);
  border-left: 4px solid var(--purple);
  border-radius: 10px;
  background: var(--panel-2);
}
.md pre code {
  padding: 0;
  border: 0;
  background: none;
  color: #d7e3ff;
  font-size: 0.85rem;
  line-height: 1.6;
}

.md blockquote {
  margin: 0 0 22px;
  padding: 16px 20px;
  border-left: 4px solid var(--pink);
  border-radius: 0 10px 10px 0;
  background: rgba(255, 60, 172, 0.06);
  color: #e9dcff;
}
.md blockquote p:last-child { margin-bottom: 0; }

.md hr { border: 0; border-top: 1px solid var(--border); margin: 40px 0; }

.table-wrap {
  overflow-x: auto;
  margin: 0 0 24px;
  border: 1px solid var(--border);
  border-radius: 10px;
}
.md table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
.md th, .md td {
  padding: 11px 14px;
  text-align: left;
  vertical-align: top;
  border-bottom: 1px solid var(--border);
}
.md thead th {
  font-family: "Press Start 2P", monospace;
  font-size: 0.5rem;
  letter-spacing: 1px;
  color: var(--cyan);
  background: var(--panel);
  white-space: nowrap;
}
.md tbody tr:nth-child(even) { background: rgba(255, 255, 255, 0.02); }
.md tbody tr:last-child td { border-bottom: 0; }
.md td code { white-space: nowrap; }

.page-footer {
  margin-top: 70px;
  padding-top: 24px;
  border-top: 1px solid var(--border);
  color: var(--muted);
  font-size: 0.82rem;
}

/* ---------------- responsive ---------------- */

@media (max-width: 900px) {
  .layout { grid-template-columns: 1fr; }
  .sidebar {
    position: static;
    height: auto;
    border-right: 0;
    border-bottom: 1px solid var(--border);
  }
  .content { padding-top: 30px; }
}

@media (prefers-reduced-motion: reduce) {
  * { animation: none !important; transition: none !important; }
}
`;

/* ---------------------------------------------------------
 * page shell
 * ------------------------------------------------------- */

function navList(docs, activeSlug, rel) {
  const items = docs
    .map((d) => {
      const cls = d.slug === activeSlug ? ' class="is-active"' : "";
      return `<li><a href="${rel}${d.slug}.html"${cls}><span class="nav-kind">${escapeHtml(
        d.kind
      )}</span>${escapeHtml(d.navTitle)}</a></li>`;
    })
    .join("\n        ");
  const homeCls = activeSlug === null ? ' class="is-active"' : "";
  return `<li><a href="${rel}index.html"${homeCls}><span class="nav-kind">HOME</span>All documents</a></li>\n        ${items}`;
}

function pageShell({ title, docs, activeSlug, body, rel = "" }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)} · GameHub /learn</title>
<meta name="description" content="${escapeHtml(PROJECT.tagline)}" />
<link rel="stylesheet" href="${rel}style.css" />
</head>
<body>
<a class="skip-link" href="#content">Skip to content</a>
<div class="layout">
  <aside class="sidebar">
    <a class="brand" href="${rel}index.html">GAME<span>HUB</span></a>
    <p class="sidebar-sub">/learn</p>
    <nav class="nav" aria-label="Learning documents">
      <ul>
        ${navList(docs, activeSlug, rel)}
      </ul>
    </nav>
    <div class="sidebar-foot">
      <a class="btn btn-primary" href="${rel}${PROJECT.pdf}">Download the PDF</a>
      <a class="btn btn-ghost" href="${PROJECT.live}">Live demo</a>
      <a class="btn btn-ghost" href="${PROJECT.repo}">GitHub repo</a>
    </div>
  </aside>
  <main id="content" class="content">
${body}
    <footer class="page-footer">
      <p>GameHub /learn — generated from <code>README.md</code> and <code>docs/*.md</code> by
      <code>scripts/build-learn.js</code>. Fonts are self-hosted (OFL); this site makes no third-party requests.</p>
    </footer>
  </main>
</div>
</body>
</html>
`;
}

function cardHtml(doc) {
  const blurb = doc.blurb || "Learning note.";
  const short = blurb.length > 190 ? blurb.slice(0, 187).trimEnd() + "…" : blurb;
  return `<a class="card" href="${doc.slug}.html">
  <span class="card-kind">${escapeHtml(doc.kind)}</span>
  <h3>${escapeHtml(doc.navTitle)}</h3>
  <p>${escapeHtml(short)}</p>
  <span class="card-open">OPEN DOCUMENT →</span>
</a>`;
}

function landingPage(docs) {
  const steps = docs.filter((d) => /^STEP/.test(d.kind)).length;
  const body = `    <p class="hero-eyebrow">GAMEHUB /LEARN</p>
    <h1 class="hero-title">Build log &amp;<span>field notes</span></h1>
    <p class="hero-lede">${escapeHtml(PROJECT.tagline)}. Every phase of this project is
    documented as an honest learning note — what was built, why that choice beat the
    alternative, the bugs found along the way, and the interview questions it unlocks.
    Read it online, or download the whole thing as a PDF.</p>
    <div class="hero-actions">
      <a class="btn btn-primary" href="${PROJECT.pdf}">Download the PDF guide</a>
      <a class="btn btn-ghost" href="${PROJECT.live}">Open the live app</a>
    </div>
    <div class="doc-meta">
      <span class="chip">${docs.length} DOCUMENTS</span>
      <span class="chip">${steps} PHASE NOTES</span>
      <span class="chip chip-source">SOURCE OF TRUTH: README + docs/</span>
    </div>

    <div class="card-grid">
${docs.map((d) => "      " + cardHtml(d)).join("\n")}
    </div>

    <section class="section-band">
      <h2>One command rebuilds all of this</h2>
      <p>The pages you are reading are generated from the Markdown in the repository —
      no static-site framework, no npm packages, no network. Running the script again
      reproduces them byte for byte, and the same content becomes a printable A4 guide.</p>
      <div class="table-wrap"><table>
        <thead><tr><th>Command</th><th>What it does</th></tr></thead>
        <tbody>
          <tr><td><code>node scripts/build-learn.js</code></td><td>Regenerate this site and the print guide</td></tr>
          <tr><td><code>./scripts/build-pdf.sh</code></td><td>Rebuild everything and render <code>learn/gamehub-guide.pdf</code></td></tr>
        </tbody>
      </table></div>
    </section>`;
  return pageShell({ title: "Learn", docs, activeSlug: null, body });
}

function documentPage(doc, docs) {
  const body = `    <div class="doc-meta">
      <span class="chip">${escapeHtml(doc.kind)}</span>
      <span class="chip chip-source">${escapeHtml(doc.source)}</span>
    </div>
    <article class="md">
${doc.html}
    </article>`;
  return pageShell({ title: doc.navTitle, docs, activeSlug: doc.slug, body });
}

/* ---------------------------------------------------------
 * the print guide (what becomes the PDF)
 * ------------------------------------------------------- */

const GUIDE_CSS = `@font-face {
  font-family: "Press Start 2P";
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url("fonts/press-start-2p-latin-400.woff2") format("woff2");
}
@font-face {
  font-family: "Chakra Petch";
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url("fonts/chakra-petch-latin-400.woff2") format("woff2");
}
@font-face {
  font-family: "Chakra Petch";
  font-style: normal;
  font-weight: 600;
  font-display: swap;
  src: url("fonts/chakra-petch-latin-600.woff2") format("woff2");
}
@font-face {
  font-family: "Chakra Petch";
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url("fonts/chakra-petch-latin-700.woff2") format("woff2");
}

/* Screen styling (also the reviewer's first impression of guide.html). */
:root {
  --cyan: #00f5ff;
  --pink: #ff3cac;
  --purple: #9b5cff;
  --ink: #12131a;
  --muted: #55596b;
  --line: #d8dbe6;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background: #eef0f6;
  color: var(--ink);
  font-family: "Chakra Petch", "Segoe UI", sans-serif;
  font-size: 10.5pt;
  line-height: 1.5;
}
.sheet {
  max-width: 820px;
  margin: 0 auto;
  background: #ffffff;
  padding: 40px 48px 64px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12);
}
.screen-only { margin-bottom: 30px; }
.sidebar { margin-bottom: 34px; }
.screen-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-bottom: 16px;
  margin-bottom: 16px;
  border-bottom: 1px solid var(--line);
}
.screen-nav a {
  font-family: "Press Start 2P", monospace;
  font-size: 8px;
  color: #0a6b73;
  text-decoration: none;
  border: 1px solid var(--line);
  border-radius: 4px;
  padding: 6px 8px;
}

/* ---- cover page ---- */
.cover { text-align: center; padding: 150px 0 120px; border-bottom: 2px solid var(--ink); }
.cover .kicker {
  font-family: "Press Start 2P", monospace;
  font-size: 9px;
  letter-spacing: 4px;
  color: var(--pink);
  margin-bottom: 40px;
}
.cover h1 {
  font-size: 52pt;
  line-height: 0.95;
  letter-spacing: -2px;
  margin: 0 0 18px;
  font-weight: 700;
}
.cover .tagline { font-size: 15pt; color: var(--muted); margin: 0 0 46px; }
.cover .meta { font-size: 10pt; color: var(--muted); line-height: 1.8; }
.cover .meta code { background: #f2f3f8; padding: 1px 5px; border-radius: 3px; }

/* ---- contents ---- */
.toc { padding: 40px 0 20px; }
.toc h2 { font-size: 20pt; margin: 0 0 20px; }
.toc ol { list-style: none; padding: 0; margin: 0; counter-reset: toc; }
.toc li { padding: 9px 0; border-bottom: 1px solid var(--line); }
.toc a { color: var(--ink); text-decoration: none; }
.toc .toc-kind {
  display: inline-block;
  min-width: 92px;
  font-family: "Press Start 2P", monospace;
  font-size: 8px;
  color: var(--pink);
}

/* ---- documents ---- */
.doc { padding-top: 6px; }
.md h1, .md h2, .md h3, .md h4, .md h5, .md h6 {
  font-weight: 700;
  line-height: 1.2;
  color: var(--ink);
  break-after: avoid;
}
.md h1 { font-size: 24pt; border-bottom: 2px solid var(--cyan); padding-bottom: 10px; margin: 0 0 20px; }
.md h2 { font-size: 15pt; margin: 26px 0 10px; }
.md h3 { font-size: 12pt; margin: 18px 0 8px; color: #0a6b73; }
.md h4 { font-size: 11pt; margin: 14px 0 6px; }
.md p { margin: 0 0 11px; }
.md strong { color: #000; }
.md a { color: #0a6b73; text-decoration: none; }
.md ul, .md ol { margin: 0 0 12px; padding-left: 22px; }
.md li { margin-bottom: 5px; }
.md code {
  font-family: ui-monospace, Menlo, Consolas, monospace;
  font-size: 0.86em;
  background: #f2f3f8;
  border: 1px solid #e2e4ee;
  border-radius: 3px;
  padding: 0 4px;
}
.md pre {
  margin: 0 0 14px;
  padding: 12px 14px;
  background: #f6f7fb;
  border: 1px solid #e2e4ee;
  border-left: 3px solid var(--purple);
  border-radius: 6px;
  white-space: pre-wrap;
  word-break: break-word;
  break-inside: avoid;
}
.md pre code { background: none; border: 0; padding: 0; font-size: 8.6pt; line-height: 1.45; }
.md blockquote {
  margin: 0 0 14px;
  padding: 9px 14px;
  border-left: 3px solid var(--pink);
  background: #fdf2f8;
  break-inside: avoid;
}
.md blockquote p:last-child { margin-bottom: 0; }
.md hr { border: 0; border-top: 1px solid var(--line); margin: 22px 0; }
.md img { max-width: 100%; height: auto; }
.md .ext-img {
  display: inline-block;
  font-family: ui-monospace, Menlo, Consolas, monospace;
  font-size: 7.6pt;
  padding: 1px 6px;
  margin: 1px 4px 1px 0;
  border: 1px solid #e2e4ee;
  border-radius: 3px;
  color: var(--muted);
}
.table-wrap { margin: 0 0 16px; }
.md table { width: 100%; border-collapse: collapse; font-size: 8.8pt; }
.md th, .md td {
  padding: 6px 8px;
  text-align: left;
  vertical-align: top;
  border: 1px solid var(--line);
}
.md thead th {
  background: #eef0f6;
  font-family: "Press Start 2P", monospace;
  font-size: 7px;
  letter-spacing: 0.5px;
  color: #4a4e63;
}
.md tr { break-inside: avoid; }
.md td code, .md th code { white-space: normal; }

/* ---- print rules (A4) ---- */
@page { size: A4; margin: 16mm 15mm 18mm; }

@media print {
  body { background: #ffffff; font-size: 10pt; }
  .sheet { max-width: none; margin: 0; padding: 0; box-shadow: none; }
  .screen-only { display: none !important; }
  .sidebar { display: none !important; }
  .cover { padding: 60mm 0 0; border-bottom: 0; break-after: page; }
  .cover h1 { font-size: 46pt; }
  .toc { break-after: page; }
  .doc { break-before: page; }
  .doc:first-of-type { break-before: auto; }
  .md a { color: #0a6b73; }
  .md a[href^="http"]::after { content: ""; }
  .md pre, .md blockquote, .table-wrap { break-inside: avoid; }
}
`;

function guidePage(docs) {
  const toc = docs
    .map(
      (d) =>
        `      <li><span class="toc-kind">${escapeHtml(d.kind)}</span><a href="#doc-${d.slug}">${escapeHtml(
          d.navTitle
        )}</a></li>`
    )
    .join("\n");

  const nav = docs
    .map((d) => `<a href="#doc-${d.slug}">${escapeHtml(d.navTitle)}</a>`)
    .join("\n      ");

  const sections = docs
    .map(
      (d) => `    <section class="doc md" id="doc-${d.slug}">
${d.html}
    </section>`
    )
    .join("\n\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(PROJECT.title)} — guide</title>
<meta name="description" content="Print-optimised guide: every GameHub learning document in one A4 document." />
<style>
${GUIDE_CSS}
</style>
</head>
<body>
  <div class="sheet">

    <aside class="sidebar" aria-label="Guide navigation">
      <nav class="screen-nav">
      <a href="index.html">← /learn home</a>
      ${nav}
      <a href="${PROJECT.pdf}">Download PDF</a>
      </nav>
    </aside>

    <header class="cover">
      <p class="kicker">GAMEHUB /LEARN — FIELD NOTES</p>
      <h1>${escapeHtml(PROJECT.title)}</h1>
      <p class="tagline">${escapeHtml(PROJECT.tagline)}</p>
      <p class="meta">
        A build log across every phase of the project — what was built, why that choice<br />
        beat the alternative, the bugs found, and the concepts worth understanding cold.<br /><br />
        Generated from <code>README.md</code> and <code>docs/*.md</code> by <code>scripts/build-learn.js</code>.<br />
        Live: <code>${escapeHtml(PROJECT.live)}</code>
      </p>
    </header>

    <nav class="toc">
      <h2>Contents</h2>
      <ol>
${toc}
      </ol>
    </nav>

${sections}

  </div>
</body>
</html>
`;
}

/* ---------------------------------------------------------
 * build
 * ------------------------------------------------------- */

const written = [];

function writeFile(rel, content) {
  const abs = path.join(OUT_DIR, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
  written.push({ rel, bytes: Buffer.byteLength(content) });
}

function copyFonts() {
  fs.mkdirSync(FONT_DST, { recursive: true });
  for (const file of fs.readdirSync(FONT_SRC).sort()) {
    const src = path.join(FONT_SRC, file);
    if (!fs.statSync(src).isFile()) continue;
    fs.copyFileSync(src, path.join(FONT_DST, file));
    written.push({ rel: path.join("fonts", file), bytes: fs.statSync(src).size });
  }
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const docs = loadDocuments();
  if (docs.length === 0) {
    console.error("✖ no source documents found");
    process.exit(1);
  }

  writeFile("style.css", SITE_CSS);
  copyFonts();

  for (const doc of docs) {
    writeFile(`${doc.slug}.html`, documentPage(doc, docs));
  }
  writeFile("index.html", landingPage(docs));
  writeFile("guide.html", guidePage(docs));

  const total = written.reduce((sum, f) => sum + f.bytes, 0);
  console.log(`✔ GameHub /learn built — ${docs.length} document(s) + landing + print guide`);
  for (const doc of docs) {
    console.log(`   · ${doc.source}  →  learn/${doc.slug}.html`);
  }
  console.log("");
  for (const f of written) {
    const kb = (f.bytes / 1024).toFixed(1).padStart(7);
    console.log(`   ${kb} KB  learn/${f.rel}`);
  }
  console.log("");
  console.log(
    `✔ ${written.length} file(s) written, ${(total / 1024).toFixed(1)} KB total → ${path.relative(
      ROOT,
      OUT_DIR
    )}/`
  );
}

main();
