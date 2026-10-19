# 🎮 GameHub

> 🇬🇧 [English version](README.md) | 🇩🇪 Deutsche Version

### Eine futuristische Gaming-Plattform, gebaut mit AWS & DevOps

[![CI](https://github.com/cijostany6-bit/GameHub/actions/workflows/ci.yml/badge.svg)](https://github.com/cijostany6-bit/GameHub/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![Tests](https://img.shields.io/badge/tests-84%20passing-brightgreen)
![Coverage](https://img.shields.io/badge/coverage-%E2%89%A580%25%20gated-blue)

GameHub ist ein Portfolio-Projekt, das eine futuristische Gaming-Oberfläche mit einem containerisierten Node.js-Backend und einer MySQL-Datenbank kombiniert — alles lokal mit einem einzigen Befehl lauffähig. Es zeigt, wie Frontend-Anwendungen, Backend-APIs, Container-Netzwerke, Reverse Proxies, Datenbanken, Tests und CI-Pipelines zusammenspielen.

Das Projekt wird zu einer Anwendung im Produktionsstil weiterentwickelt: automatisierte CI/CD, Infrastruktur als Code auf AWS, Monitoring und Kubernetes (lokaler kind-Cluster + Argo CD).

> **Status — Phase 8 abgeschlossen (2026-10-19):** getestet, in CI, spielerisch,
> spielbar und **live auf AWS**, beobachtbar, auf Kubernetes lauffähig, gehärtet —
> und dokumentiert. 84 automatisierte Tests, ein Cognito-Anmelde-Gate mit
> **funktionierender Kontolöschung** (DSGVO Art. 17, in der App statt in einem
> Richtliniendokument), ein zweisprachiger Datenschutzhinweis, eine SBOM +
> Image-Scanning in CI, per CI-Gate gesicherte Deploys und eine
> `t3.micro`-Lasttest-Messung. Alles als CloudFormation beschrieben und per
> schlüssellosem GitHub-OIDC deployt.

**Live-Demo:** <https://d2qf9zxehny6bk.cloudfront.net> — lege ein Konto an
(E-Mail-Bestätigung), melde dich an und spiele. Die Landing Page ist öffentlich;
der Katalog und die Spiele erfordern einen angemeldeten Spieler.

**Dokumentation:** Die Schritt-für-Schritt-Dokumentation, die ADRs und das Runbook
sind als statische Seite unter
**<https://d2qf9zxehny6bk.cloudfront.net/learn/>** veröffentlicht, das komplette
Handbuch zusätzlich als druckbares PDF — jede Aussage darin ist auf einen Commit
und einen CI-Lauf zurückführbar.

---

## 📌 Projektstatus

**Aktuelle Phase:** Phase 8 — /learn-Dokumentationsseite, PDF & Lasttest ✅ (siehe
[`docs/step-8-learn-site.md`](docs/step-8-learn-site.md) und
[`docs/load-test.md`](docs/load-test.md))

**Status:** Der Full Stack läuft lokal durchgängig: `make bootstrap` → befüllte Datenbank, gesunde Container, bestandene Smoke-Tests. Keine Cloud-Ressourcen erforderlich.

### ✅ Abgeschlossen (Phase 0)

- Futuristische Gaming-Startseite
- Eigene Games-Seite
- Dynamischer Spielkatalog, geladen über eine Backend-API (12 vorbefüllte Datensätze)
- Filter nach Spielkategorie
- Frontend gebaut mit HTML, CSS und JavaScript
- Node.js- und Express-Backend
- **Lokaler MySQL-8.4-Container** mit Schema + Seed (`db/init.sql`) — reproduzierbar auf jeder Maschine, kein Cloud-Konto nötig
- **Connection Pool** (keine Verbindung pro Anfrage), **Trennung von Liveness/Readiness** (`/api/health` vs. `/api/ready`), strukturierte JSON-Logs, CORS auf explizite Origins beschränkt, generische Fehler gegenüber Clients
- Dockerisiertes Frontend und Backend auf dem **Alpine-Stable-Kanal** (von Dependabot verfolgt, zur Build-Zeit mit Security-Patches versorgt), `npm ci` aus der Lockfile, **0 npm-Schwachstellen**, Backend läuft als **Non-Root**
- Docker-Compose-Orchestrierung mit **Healthchecks + geordnetem Start**
- Nginx-Reverse-Proxy (gzip, Security-Header) — Backend-Port **nicht** auf dem Host veröffentlicht
- `make bootstrap` als Ein-Befehl-Workflow + **Smoke-Test** (`scripts/smoke.sh`)
- Einrichtung von Git- und GitHub-Repository

### ✅ Abgeschlossen (Phase 1 — Tests & CI)

- **14 automatisierte Tests** mit dem in Node integrierten `node:test` (keine zusätzlichen Test-Abhängigkeiten):
  Unit-Suite (läuft überall, ohne DB) + Integrations-Suite gegen echtes MySQL
  (wird laut übersprungen, wenn keine Datenbank erreichbar ist)
- Verhaltensabdeckung der Pfade, die zählen: Liveness übersteht einen
  Datenbank-Ausfall, während Readiness 503 liefert, CORS lehnt unbekannte Origins
  ab, Treiberfehler gelangen nie zu Clients, fehlerhaftes JSON → 400
- **Coverage-Gate**: ≥80 % Lines / Branches / Functions, sonst schlägt CI fehl
- **ESLint** (Flat Config) als Build-Gate
- **GitHub-Actions-CI — 3 Jobs bei jedem Push/PR:**
  1. Lint + Tests + Coverage-Gate gegen einen MySQL-**Service-Container**
  2. **Full-Stack-Smoke-Test** — baut die echten Docker-Images, führt den echten
     Compose-Stack auf dem Runner aus
  3. **Security-Scans** — gitleaks (vollständige Historie), Trivy (CRITICAL/HIGH), npm audit
- Lokale Entsprechungen: `make test` · `make lint` · `make coverage`

### ✅ Abgeschlossen (Phase 2 — spielerische UI)

- **Live-animierter Hintergrund**: Canvas-Sternenfeld (3 Parallax-Ebenen, Pixel-
  Sterne), aufsteigende Neon-Pixel-Partikel, seltene Sternschnuppen — dazu ein
  scrollendes Gitter und eine driftende Neon-Kugel. Keine JS-Abhängigkeiten,
  ~118 Draw Calls/Frame
- **DSGVO-saubere Fonts**: Press Start 2P (Arcade-Akzente) + Chakra Petch
  (Überschriften/Fließtext) **selbst gehostet** als woff2 mit OFL-Lizenzen im
  Repo — der Google-Fonts-CDN-Import ist entfernt, also **null Drittanbieter-Requests**
  beim Laden
- **Barrierefreiheit**: Besucher mit `prefers-reduced-motion` erhalten eine
  vollständig statische Seite (das Canvas wird gar nicht erst erzeugt)
- Arcade-Styling für alle interaktiven Elemente (PS2P-Buttons mit Druckgefühl)

### ✅ Abgeschlossen (Phase 3 — echte spielbare Spiele)

- **Alle 12 Katalogspiele sind tatsächlich spielbar** — `play.html?id=<n>` lädt
  den Titel und führt eine von **6 abhängigkeitsfreien Canvas-Engines** aus: Snake,
  Breakout, Survival-Racing (Dodge), Memory, Reflex-Zielen, Pong
- Runner-Zustandsmaschine: READY → PLAYING → GAME OVER mit **Play again**, HUD
  (Score / Best / Status), pro Titel **Highscores in localStorage** (abgesichert),
  Steuerungshilfe, Escape → Katalog
- **`GET /api/games/:id`**-Endpunkt: ehrliche 404s für unbekannte *und* nicht
  numerische IDs; fehlerhaftes/zu großes JSON jetzt 400/413 statt 500
- **Frontend-Tests (21)**: die sechs Engines laufen in Node gegen ein
  gestubbtes Canvas — frame-getrieben, mit Prüfung echter Endzustände; dazu ein
  **Coverage-Contract-Test**, der CI fehlschlagen lässt, wenn einem vorbefüllten
  Titel eine Engine fehlt
- Ein Engine-Test fand und behob einen echten Stall-Bug (Breakout-Treffer im
  toten Zentrum → vertikaler Ball → ungewinnbares Spiel)

### ✅ Abgeschlossen (Phase 4 — echte Auth + live auf AWS)

- **Cognito-Anmelde-Gate**: Registrierung mit E-Mail-Bestätigung, Anmeldung, Abmeldung.
  Das statische Frontend spricht direkt mit der REST-API von Cognito (kein Amplify,
  kein SDK) und sendet das ID-Token als `Bearer`-Header bei jedem `/api/*`-Aufruf
- **Serverseitige Token-Verifikation** (`backend/auth.js`): RS256-Signatur geprüft
  gegen die JWKS des Pools mit `node:crypto`, dazu `iss`, `aud`/`client_id`,
  `exp` und `token_use` — keine Abhängigkeit von `jsonwebtoken`
- **Ehrliches Fail-Open**: Das Gate wird nur durchgesetzt, wenn der Pool
  konfiguriert ist; die lokale Entwicklung läuft offen und das Backend protokolliert
  beim Start eine `auth_disabled`-Warnung — niemals eine stille Umgehung
- **Statische Website auf S3 + CloudFront**: privater Bucket, CloudFront Origin
  Access Control, `/api/*`-Verhalten mit deaktiviertem Caching, HTML-Kurzeit-Cache
  vs. Long-Cache für Assets
- **API-Host auf EC2**, der dieselbe `docker-compose.yml` wie die lokale
  Entwicklung ausführt (nginx + Express + MySQL), mit einer 2-GB-Swap-Datei
  als Reserve
- **Kein SSH**: Die Security Group öffnet Port 8080 nur für die von AWS
  verwaltete CloudFront-Origin-facing-Prefix-Liste; die Administration erfolgt über
  SSM Session Manager, IMDSv2 ist erforderlich und das Root-Volume ist verschlüsselt
- **Vier CloudFormation-Stacks** (`infra/cognito.yaml`, `site.yaml`,
  `backend.yaml`, `github-oidc.yaml`) — ein Befehl pro Stack, die Outputs werden
  in den nächsten Stack eingespeist
- **Schlüssellose Deploys**: GitHub Actions übernimmt über OIDC eine eingeschränkte
  Rolle (keine AWS-Zugriffsschlüssel irgendwo); der Workflow veröffentlicht die
  Website, invalidiert CloudFront und rollt den API-Host über SSM aus
- **Die Landing Page bleibt öffentlich**, während Katalog und Runner einen
  angemeldeten Spieler erfordern — entdeckt, indem ich mich live abgemeldet und
  der Weiterleitung gefolgt bin, nicht beim Lesen des Codes
- **Versionierte Asset-URLs** (`script.js?v=<deploy sha>`): Assets werden eine
  Woche gecacht, sodass eine CloudFront-Invalidierung allein wiederkehrende
  Browser noch am vorherigen Skript festhält. Das HTML (Ein-Minuten-Cache) zeigt
  auf die neue Version — entdeckt, als nach einem Deploy ein veraltetes
  `script.js` im Browser lief

### ✅ Abgeschlossen (Phase 5 — Observability)

- **Strukturierte Request-Logs**: nginx schreibt JSON-Access-Logs (`status`,
  `uri`, `request_time`, `upstream_time`) — CloudWatch parst sie ohne Regex-Raten
- **CloudWatch-Agent auf dem Host**: liefert diese Logs plus Container-stdout an
  `/gamehub/prod/nginx-access` und `/gamehub/prod/app` (7-Tage-Aufbewahrung, vom
  Template gesetzt) sowie Host-Metriken für `mem`/`disk`/`swap` in den
  `CWAgent`-Namespace — per user-data installiert, keine manuelle Einrichtung
- **Aus Logs abgeleitete Metriken** (`AWS::Logs::MetricFilter`): Request-Anzahl,
  5xx-Anzahl und API-Latenz als *numerische* Extraktion (`$.request_time`) für
  p50/p99 — nginx kannte die Zahlen schon, daher wird die App nicht mit einer
  zusätzlichen Bibliothek instrumentiert, um sie zu wiederholen
- **Externe Verfügbarkeitsprüfung**: EventBridge führt alle 5 Minuten ein kleines
  Lambda gegen die öffentliche CloudFront-URL und `/api/health` aus; seine Logzeile
  wird zur Metrik `SyntheticSuccess` — ein synthetischer Check ohne das Preisschild
  von CloudWatch Synthetics
- **Acht Alarme** in einem SNS-Topic: synthetische Verfügbarkeit (`TreatMissingData:
  breaching` — Stille ist ein Ausfall), 5xx-Anzahl, API-p99-Latenz, Instanzstatus,
  CPU, CPU-Credits, Memory und Disk. Host-Metrik-Alarme behandeln fehlende Daten als
  `notBreaching`, denn ein gestoppter Agent ist kein Ausfall
- **Ein Dashboard** (`gamehub-prod`): Verfügbarkeit, Requests vs. Fehler,
  Latenz-Perzentile, Host-Auslastung und zwei Live-Log-Tabellen (letzte 5xx,
  Backend-Tail)
- **SLOs mit Error Budgets** ([`docs/slo.md`](docs/slo.md)): 99,5 % Verfügbarkeit
  und p99 ≤ 1,5 s über rollende 30 Tage, mit der Messmethode für jeden —
  und einer expliziten Liste dessen, was **nicht** zugesagt wird, weil eine
  Single-AZ-t3.micro das ehrlich nicht versprechen kann
- **Runbook** ([`docs/runbook.md`](docs/runbook.md)): ein Abschnitt pro Alarm mit
  den exakten SSM/Logs-Insights-Befehlen, um die Ursache zu bestätigen, plus dem
  Pfad für Revert/Rollback
- **Live verifiziert, nicht angenommen**: die Metrik-Dimensionen des Agenten wurden
  per `list-metrics` zurückgelesen und dann ins Template geschrieben — ein Alarm
  mit falschem Dimensionssatz verharrt für immer in `INSUFFICIENT_DATA`

### ✅ Abgeschlossen (Phase 6 — lokales Kubernetes + Argo CD GitOps)

- **Echter Cluster, keine Rechnung**: ein Single-Node-[kind](https://kind.sigs.k8s.io/)-
  Cluster (`k8s/kind-config.yaml`) mit denselben Images, die der Compose-Stack baut,
  side-geladen in den Node (`make kind-up`)
- **Deployments und ein StatefulSet**: Frontend und Backend laufen mit je 2 Replicas
  und `maxUnavailable: 0`-Rollouts; MySQL ist ein StatefulSet mit
  Volume-Claim-Template — ein Deployment würde der Datenbank einen zufälligen Namen
  geben und zwei Pods um ein Datenverzeichnis kämpfen lassen
- **Probes mit Konsequenzen**: Liveness auf `/api/health` (ohne Datenbank),
  Readiness auf `/api/ready` (Datenbank) — ein DB-Ausfall stoppt neuen Verkehr,
  statt jeden Pod neu zu starten
- **Eine einzige Quelle der Wahrheit für den Seed**: `db/init.sql` wird von
  `scripts/build-k8s-dbinit.sh` in eine ConfigMap gerendert, und CI schlägt fehl,
  wenn die Kopie von der Quelle abweicht
- **Least Privilege, gemessen statt angenommen**: Das Backend läuft als
  unprivilegierter `node`-Benutzer mit `drop: ALL`; nginx behält genau die fünf
  Capabilities, die sein Root-Masterprozess braucht — der erste Versuch mit
  `drop: ALL` erzeugte `CrashLoopBackOff` mit `chown(...) failed (1: Operation not
  permitted)`, weshalb die Liste jetzt mit Begründung niedergeschrieben ist
- **GitOps mit Argo CD** (`k8s/argocd/application.yaml`): `automated`-Sync mit
  `prune` und `selfHeal`, sodass der Merge nach `main` *das* Deployment ist und
  eine manuelle `kubectl`-Änderung vom Controller zurückgesetzt wird
- **Verifiziert wie der Rest des Projekts**: Dasselbe `scripts/smoke.sh` läuft
  gegen den NodePort des Clusters (8081, damit Compose auf 8080 weiterläuft) und
  besteht — 12 Spiele, ausgeliefert aus dem StatefulSet über den nginx-Proxy
- **CI deckt es ab**: ein `manifests`-Job validiert jedes Manifest gegen das
  Kubernetes-Schema (kubeconform) und prüft die generierte ConfigMap auf Drift

### ✅ Abgeschlossen (Phase 7 — Security-Härtung & DSGVO)

- **Löschung, die umgesetzt ist und nicht nur versprochen wird**: `DELETE /api/me`
  löscht die Zeilen des Spielers **und** seine Cognito-Identität in einer Aktion
  von der [Kontoseite](frontend/profile.html) aus. Ein Teilergebnis wird als
  Teilergebnis gemeldet (`502`), niemals als Erfolg
- **Die Kontoseite ist die DSGVO-Oberfläche**: Sie *ist* die Antwort auf Auskunft/
  Portabilität (Identität + jede gespeicherte Zeile, als JSON kopierbar) und trägt
  die Löschkontrolle — eine Seite, drei der vier Rechte, keine Support-E-Mail
- **Ein zweisprachiger Datenschutzhinweis** ([`frontend/privacy.html`](frontend/privacy.html)):
  ein Dateninventar mit Zweck, Rechtsgrundlage und Aufbewahrung pro Eintrag —
  einschließlich der 7-Tage-Zugriffslogs, die ebenfalls personenbezogene Daten sind
- **Ein AWS-Aufruf, von Hand signiert**: Die Kontolöschung benötigt
  `cognito-idp:AdminDeleteUser`, also holt das Backend IMDSv2-Zugangsdaten und
  signiert die Anfrage selbst (SigV4, `node:crypto`) — kein AWS SDK, keine
  langlebigen Schlüssel, und die Signatur wird in der Testsuite Feld für Feld
  geprüft
- **Least Privilege auf der Identität**: Die Inline-Policy der Instanzrolle erlaubt
  diese *eine* Aktion auf *einem* User-Pool-ARN, nicht `CognitoPowerUser` auf `*`
- **Datenminimierung im Schema**: eine `personal_bests`-Zeile pro `(Spieler, Spiel)`
  mit `GREATEST()` bei Konflikt — der beste Punktestand, keine Spielhistorie —
  mit dem Cognito-`sub` als Schlüssel, sodass die Datenbank keine E-Mail-Adresse
  enthält
- **Migrationen mit einem Ledger** (`scripts/migrate.sh`, `db/migrations/`):
  `db/init.sql` läuft nur auf einem leeren Volume, daher werden Schemaänderungen
  als mit Prüfsumme versehene, idempotente Migrationen ausgeliefert; eine
  umgeschriebene Migration wird abgelehnt
- **Supply Chain in CI**: SPDX-SBOM (syft) als Artefakt aufbewahrt, Trivy gegen
  das **gebaute Image** ebenso wie gegen das Dateisystem, `npm audit`, gitleaks
  über die vollständige Historie und Dependabot für npm, Actions und Basis-Images
- **Deploys sind CI-gated**: Der Deploy-Workflow läuft bei einem *erfolgreichen
  CI-Lauf für genau diesen Commit* (nie auf einer späteren, ungetesteten Spitze
  von `main`) und endet mit einem Post-Deploy-Smoke-Test gegen die öffentliche
  URL — Homepage-Markup, alle 12 Katalogeinträge, Spieldetails und ein `401` von
  einem nicht authentifizierten `/api/me`

### ✅ Abgeschlossen (Phase 8 — /learn-Dokumentationsseite, PDF, Lasttest)

- **Eine aus dem Repository generierte Dokumentationsseite**:
  [`scripts/build-learn.js`](scripts/build-learn.js) (abhängigkeitsfrei, nur
  Node-Bordmittel) rendert `README.md` und jede `docs/*.md` nach `learn/` — eine
  Landing Page, eine Seite pro Dokument und ein Druck-Handbuch, mit einem
  selbstgeschriebenen Markdown-Renderer inklusive GitHub-Tabellen
- **Zusammen mit der App veröffentlicht**: `build-frontend.sh` kopiert `learn/`
  in das deploybare Artefakt, sodass **dieselbe** CloudFront-Distribution das
  Handbuch unter **`/learn/`** ausliefert — kein zweiter Bucket, kein zweites CDN
  und keine Chance, dass der Root-Sync die Doku versehentlich löscht
- **Ein herunterladbares PDF**: `scripts/build-pdf.sh` druckt die
  druckoptimierte `learn/guide.html` über den auf dem Rechner ohnehin
  vorhandenen Browser (A4-`@page`-CSS) nach `learn/gamehub-guide.pdf`
- **Ein CI-Drift-Check**: Die generierte Seite ist eingecheckt, also regeneriert
  der `manifests`-Job sie und schlägt bei jeder Abweichung fehl — und prüft
  zusätzlich, dass jedes Dokument eine Seite hat. Ein generiertes Artefakt, das
  nie geprüft wird, veraltet
- **Ein Lasttest mit echtem Bericht**: [`scripts/load-test.js`](scripts/load-test.js)
  (abhängigkeitsfrei, eingecheckt) fährt einen gewichteten Mix aus statischem
  Traffic, API und Probe; [`docs/load-test.md`](docs/load-test.md) hält die
  gemessenen Zahlen für eine einzelne `t3.micro` fest — inklusive der
  Server-Seite, des Cache-Verhaltens, dessen, was die Alarme getan haben, und
  einer expliziten Liste dessen, was der Test **nicht** belegt
- **Löschung durch ein Skript verifiziert, nicht per Hand**:
  `scripts/verify-gdpr.sh` legt einen echten Cognito-Nutzer an, speichert einen
  Score, löscht das Konto über die öffentliche API und prüft, dass sowohl die
  Zeile als auch die Identität verschwunden sind — inklusive Aufräumen im
  Fehlerfall
- **Architekturentscheidungen in einer Datei**: [`docs/decisions.md`](docs/decisions.md)
  — 15 Entscheidungen in den Formen Kontext / Entscheidung / Konsequenzen /
  verworfene Alternativen, jede mit Angabe dessen, was sie kostet

### 🚧 Nächstes (bewusst nicht begonnen)

- Eine eigene Domain vor CloudFront (Zertifikat + DNS-Eintrag; die Distribution
  existiert bereits)
- Umzug der Datenbank auf RDS (Multi-AZ, automatische Backups, verwaltete
  Patches) — der Kosten-/Betriebs-Kompromiss, den ADR-002 in
  [`docs/decisions.md`](docs/decisions.md) festhält

---

## 🏗️ Architektur

```text
                         Browser
                            |
                            | HTTP :8080
                            v
                    Frontend Nginx
                     Container :80
                            |
                       /api/*
                            |
                            v
                    gamehub-network
                            |
                            v
                    Node.js + Express
                     Backend :3000
                            |
                         MySQL :3306
                            |
                            v
                     MySQL 8.4 container
                   (seeded by db/init.sql)
```

### Request-Ablauf

1. Ein Benutzer öffnet GameHub im Browser.
2. Nginx liefert die statischen Frontend-Dateien aus.
3. JavaScript sendet API-Anfragen an den `/api/`-Pfad des Frontends.
4. Nginx leitet diese Anfragen an den Backend-Container weiter.
5. Express verarbeitet die Anfrage und fragt den MySQL-Container über das private Docker-Netzwerk ab.
6. Das Backend gibt JSON zurück, das das Frontend zum Rendern der Spielkarten verwendet.

**Wichtig:** Der Browser greift über Port `8080` auf das Frontend zu. Der Nginx-Container kommuniziert mit dem Backend über Docker-Netzwerking, und der Backend-Port ist **nicht auf dem Host veröffentlicht** — die Datenbank läuft als lokaler MySQL-Container (manuell verwaltet, nicht durch IaC — siehe Hinweis im Abschnitt Datenbank).

### Live-Deployment (Phase 4)

```text
                        Browser
                           |
                           | HTTPS            Cognito user pool
                           v                  (sign-up / sign-in)
                   CloudFront  <---------------------------+
                     |      |                              |
        default behavior|     \__ /api/* (caching disabled)  |
                        v                    |              |
                  S3 bucket                  v              |
          (private, OAC, static UI)     EC2 t2.micro :8080  |
                                             |              |
                                    SG: CloudFront prefix   |
                                    list only, no SSH; SSM  |
                                             v              |
                                 nginx → Express → MySQL    |
                                 (same compose stack)       |
                                             |              |
                                             +--- JWKS -----+
```

Der Browser meldet sich bei Cognito an, erhält ein **ID-Token** und sendet es als
`Authorization: Bearer <token>` bei jedem API-Aufruf. Das Backend verifiziert die
RS256-Signatur des Tokens gegen die öffentlichen JWKS des Pools — der Frontend-Guard
ist UX, die API ist die Sicherheitsgrenze.


---

## 🧰 Technologie-Stack

| Technologie | Zweck |
|---|---|
| HTML5 | Struktur des Frontends |
| CSS3 | Styling und responsives visuelles Design |
| JavaScript | UI-Interaktionen, API-Anfragen und Kategoriefilter |
| Node.js | JavaScript-Laufzeitumgebung des Backends |
| Express.js | REST-API |
| MySQL 8.4 | Relationale Datenbank, lokaler Container (verwaltetes RDS via IaC in Phase 4) |
| Docker | Containerisierung der Anwendung |
| Docker Compose | Orchestrierung mehrerer Container |
| Nginx | Statischer Webserver und Reverse Proxy |
| Git | Versionskontrolle |
| GitHub | Hosting des Quellcodes |
| Colima | Lokale Docker-Laufzeitumgebung unter macOS |
| Make | Ein-Befehl-Entwicklerworkflow (`make bootstrap`) |
| Amazon Cognito | Registrierung/Anmeldung von Spielern, gibt das ID-Token aus, das die API verifiziert |
| Amazon S3 + CloudFront | Statisches Site-Hosting (privater Bucket, OAC) und globale Edge-Auslieferung |
| Amazon EC2 | Hostet den Compose-Stack (nginx + API + MySQL) |
| AWS CloudFormation | Gesamte Infrastruktur als Code (`infra/*.yaml`) |
| AWS Systems Manager | Schlüssellose Administration und Deploys über SSM, ohne SSH |
| GitHub Actions OIDC | Schlüssellose Deploys: kurzlebige AWS-Anmeldedaten, keine gespeicherten Secrets |

---

## 📁 Projektstruktur

```text
GameHub/
├── frontend/
│   ├── index.html          ← landing page (hero, tournaments, leaderboard)
│   ├── games.html          ← catalogue (rendered from the API)
│   ├── play.html           ← game runner host (READY → PLAYING → GAME OVER)
│   ├── signin.html         ← Cognito sign-in
│   ├── signup.html         ← Cognito sign-up + email confirmation step
│   ├── profile.html        ← account page: stored data, JSON export, deletion
│   ├── privacy.html        ← bilingual (EN/DE) privacy notice
│   ├── script.js           ← homepage + catalogue logic
│   ├── play.js             ← runner: ENGINE_MAP, HUD, high scores
│   ├── engines.js          ← 6 dependency-free canvas game engines
│   ├── auth.js             ← Cognito REST client, session, page guard
│   ├── account.js          ← account page: fetch scores, export, delete
│   ├── config.js           ← runtime config (local dev: auth off)
│   ├── bg.js               ← animated arcade background
│   ├── style.css
│   ├── fonts/              ← self-hosted game fonts (OFL)
│   ├── nginx.conf
│   └── test/               ← engine, mapping contract and auth tests
├── backend/
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── .env.example        ← copy to .env only for non-Docker runs
│   ├── db.js               ← connection pool
│   ├── auth.js             ← Cognito JWKS verification (no SDK)
│   ├── cognito.js          ← IMDSv2 credentials + SigV4 AdminDeleteUser
│   ├── app.js              ← Express app (exported for tests)
│   ├── server.js           ← HTTP entrypoint
│   ├── test/               ← unit, integration, auth, GDPR and signer suites
│   ├── package.json
│   └── package-lock.json
├── db/
│   ├── init.sql            ← schema + seed (runs on first boot)
│   └── migrations/         ← checksummed migrations applied to live schemas
├── infra/
│   ├── cognito.yaml        ← user pool + app client
│   ├── site.yaml           ← S3 + CloudFront (+ /api/* origin)
│   ├── backend.yaml        ← EC2 host, security group, IAM, elastic IP
│   ├── observability.yaml  ← log groups, metric filters, canary, alarms
│   └── github-oidc.yaml    ← OIDC provider + scoped deploy role
├── k8s/
│   ├── kind-config.yaml     ← single-node kind cluster (node port → host 8081)
│   ├── namespace.yaml
│   ├── config.yaml          ← ConfigMap (app config) + local-only Secret
│   ├── db.yaml              ← MySQL StatefulSet + headless Service + PVC
│   ├── db-init-configmap.yaml ← GENERATED from db/init.sql (CI checks drift)
│   ├── backend.yaml         ← Express Deployment + `backend` Service
│   ├── frontend.yaml        ← nginx Deployment + NodePort Service
│   └── argocd/
│       └── application.yaml ← Argo CD Application (prune + selfHeal)
├── scripts/
│   ├── smoke.sh            ← end-to-end checks
│   ├── build-frontend.sh   ← builds the deployable static artifact
│   ├── deploy-frontend.sh  ← S3 sync + CloudFront invalidation
│   ├── kind-up.sh          ← cluster + images + manifests + smoke test
│   ├── argocd-up.sh        ← install Argo CD, sync the app, wait for Healthy
│   ├── build-k8s-dbinit.sh ← renders the DB seed ConfigMap (--check in CI)
│   ├── migrate.sh          ← applies db/migrations (ledger + checksums)
│   ├── build-learn.js      ← builds the /learn site from docs/
│   └── build-pdf.sh        ← renders the guide to PDF
├── learn/                  ← generated documentation site + PDF
├── .github/
│   ├── dependabot.yml      ← weekly npm / Actions / base-image updates
│   └── workflows/
│       ├── ci.yml          ← lint, tests, coverage, compose smoke, manifests, scans
│       └── deploy.yml      ← CI-gated OIDC deploy + post-deploy verification
├── docs/                   ← learning notes, SLOs, runbook, ADRs
├── Dockerfile              ← frontend image (nginx)
├── docker-compose.yml      ← frontend + backend + db
├── Makefile                ← make bootstrap / up / smoke / test / db-reset
├── .dockerignore
├── .gitignore
└── README.md
```

**Sicherheitshinweis:** Für die lokale Entwicklung sind keine Anmeldedaten nötig — die Standardwerte in `docker-compose.yml` gelten nur für das private Docker-Netzwerk. Wenn du den Server außerhalb von Docker ausführst, kopiere `backend/.env.example` nach `backend/.env`. Echte `.env`-Dateien sind von Git **und** von Image-Builds ausgeschlossen (`backend/.dockerignore`).

---

## 🚀 GameHub lokal ausführen

### Voraussetzungen

- macOS oder Linux
- Git
- Eine Docker-Laufzeitumgebung + Docker Compose
  (auf diesem Mac: [Colima](https://github.com/abiosoft/colima) — starte es mit `colima start`)

**Keine Konfiguration nötig.** Der Stack kommt mit funktionierenden lokalen
Standardwerten: Ein MySQL-Container wird beim ersten Start automatisch aus
`db/init.sql` befüllt.

### 1. Klonen und bootstrappen

```bash
git clone https://github.com/cijostany6-bit/GameHub.git
cd GameHub
make bootstrap        # build → start → wait for health → run smoke tests
```

### 2. GameHub öffnen

**http://localhost:8080**

### Nützliche Befehle

```bash
make ps               # container status (healthy?)
make logs             # tail all logs
make smoke            # re-run the end-to-end checks
make test             # backend unit + integration tests (needs MySQL)
make test-frontend    # game-engine, mapping-contract and auth tests (Node only)
make down             # stop, keep database data
make db-reset         # wipe + re-seed the database
make clean            # full teardown incl. images and DB volume
make kind-up          # same app on a local Kubernetes cluster (kind) → :8081
make argocd-up        # install Argo CD and sync the manifests from Git
make k8s-dbinit       # re-render the Kubernetes DB seed ConfigMap
make learn            # rebuild the /learn docs site and the PDF
make migrate          # apply db/migrations to the running database
make load-test SITE_URL=https://…   # dependency-free load test (see docs/load-test.md)
make verify-gdpr      # verify account deletion end to end (needs a deployment)
make help             # list all targets
```

Lieber reines Compose? `docker-compose up -d --build` und dann `./scripts/smoke.sh` bewirkt dasselbe.

### 3. Oder auf Kubernetes ausführen

```bash
make kind-up     # kind cluster + images + manifests + the same smoke test
make argocd-up   # Argo CD takes over from Git: Synced + Healthy
```

Der Cluster veröffentlicht die App auf **http://localhost:8081**, sodass er neben
dem Compose-Stack auf 8080 laufen kann. `make kind-down` löscht den Cluster; die
Docker-Images bleiben. Alles darüber — einschließlich dessen, was er *nicht*
verspricht — steht in
[`docs/step-6-kubernetes-gitops.md`](docs/step-6-kubernetes-gitops.md).

---

## ☁️ Auf AWS deployen

Alles ist CloudFormation in [`infra/`](infra/) — fünf kleine Stacks, jeder mit
einem einzigen Befehl. Stack-Outputs speisen den nächsten Stack, sodass es keine
Tabelle mit IDs gibt, die man von Hand kopieren muss.

```bash
export AWS_REGION=eu-central-1

# 1. Cognito user pool + app client
aws cloudformation deploy --region "$AWS_REGION" \
  --stack-name gamehub-cognito --template-file infra/cognito.yaml \
  --parameter-overrides Stage=prod

# 2. S3 + CloudFront (deployed first without an API origin)
aws cloudformation deploy --region "$AWS_REGION" \
  --stack-name gamehub-site --template-file infra/site.yaml \
  --parameter-overrides Stage=prod

# 3. EC2 host running the compose stack (needs the CloudFront domain)
aws cloudformation deploy --region "$AWS_REGION" \
  --stack-name gamehub-backend --template-file infra/backend.yaml \
  --parameter-overrides \
    Stage=prod \
    CognitoUserPoolId=<pool id> \
    CognitoClientId=<client id> \
    SiteOrigin=<https://cloudfront domain> \
    DbPassword=<16+ chars> RootDbPassword=<16+ chars>

# 4. Re-deploy the site stack with the API origin attached, then publish
aws cloudformation deploy --region "$AWS_REGION" \
  --stack-name gamehub-site --template-file infra/site.yaml \
  --parameter-overrides Stage=prod BackendOriginDomain=<ec2 public dns>

AWS_REGION=$AWS_REGION ./scripts/deploy-frontend.sh

# 5. Observability: log groups + retention, metrics from logs, the synthetic
#    check, eight alarms and the dashboard. AlarmEmail is optional — without it
#    the SNS topic is still created and can be subscribed later (see the
#    TopicArn output), it just has no subscriber yet.
aws cloudformation deploy --region "$AWS_REGION" \
  --stack-name gamehub-observability --template-file infra/observability.yaml \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    Stage=prod \
    InstanceId=<ec2 instance id> \
    SiteUrl=<https://cloudfront domain> \
    AlarmEmail=<you@example.com>
```

Deploye den Observability-Stack **bevor** der CloudWatch-Agent des Hosts seine
erste Logzeile schreibt: Das Template besitzt die Log-Gruppen, damit deren
Aufbewahrung gesetzt ist, und eine vom Agenten erstellte Gruppe würde diese
Ressource mit `AlreadyExists` fehlschlagen lassen.

Für Continuous Deployment deploye den vierten Stack
(`infra/github-oidc.yaml`) einmal und setze dann diese GitHub-Repository-Variablen
und pushe nach `main` — der [Deploy-Workflow](.github/workflows/deploy.yml)
erledigt den Rest über OIDC, ohne dass irgendwo AWS-Schlüssel gespeichert sind:

`AWS_REGION`, `AWS_DEPLOY_ROLE_ARN`, `SITE_BUCKET`, `DISTRIBUTION_ID`,
`INSTANCE_ID`, `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`.

Der Workflow läuft nicht beim Push selbst. Er läuft, wenn [CI](.github/workflows/ci.yml)
**auf `main` erfolgreich ist** (`workflow_run` + `conclusion == 'success'`) und
checkt den von CI getesteten Commit aus, sodass die Produktion niemals einen
Commit erhält, der nicht beurteilt wurde. Der Rollout zieht dann die Revision auf
dem Host, baut die Container neu, wartet auf MySQL und wendet ausstehende
Migrationen an (`./scripts/migrate.sh`), bevor ein abschließender Job die
öffentliche CloudFront-URL smoke-testet — Homepage, alle 12 Katalogeinträge,
Spieldetails und ein `401` von einem nicht authentifizierten `/api/me`.

**Kostenhinweis (ehrlich):** die Website (S3 + CloudFront), Cognito und die vier
CloudFormation-Stacks liegen bei diesem Verkehrsaufkommen im Free Tier. Die
EC2-Instanz ist der einzige Kostenpunkt: Dieses Konto läuft in einem Free Plan,
daher lehnt AWS Instanztypen ab, die nicht Free-Tier-berechtigt sind (`t2.micro`
schlug fehl mit "not eligible for Free Tier") — der Stack verwendet deshalb
standardmäßig `t3.micro`. Auf einem Konto ohne Free Tier sind das ungefähr
8 USD/Monat. Baue alles in umgekehrter Reihenfolge mit
`aws cloudformation delete-stack` ab.

---

## 🔌 Backend-API

Die folgenden Endpunkte sind in der aktuellen Anwendung implementiert.

| Methode | Endpunkt | Zweck |
|---|---|---|
| GET | `/api/health` | **Liveness** — Prozess läuft (berührt nie die Datenbank) |
| GET | `/api/ready` | **Readiness** — Datenbank erreichbar, Verkehr kann geroutet werden (sonst 503) |
| GET | `/api/games` | Spiele aus der Datenbank abrufen |
| GET | `/api/games/:id` | Einzelnes Spiel (treibt den Runner an); 404 für unbekannte *und* nicht numerische IDs |
| GET | `/api/me` | Gibt die verifizierte Cognito-Identität zurück — Beweis, dass das Token geprüft wurde |
| POST | `/api/scores` | Speichert den besten Punktestand des Spielers für ein Spiel (Upsert, `GREATEST`) — `201` mit dem gespeicherten Bestwert |
| GET | `/api/scores/me` | Jede gespeicherte Zeile des Aufrufers: die Antwort auf Auskunft/Portabilität |
| DELETE | `/api/me` | **Löschung** — löscht die Punktestände des Aufrufers *und* seine Cognito-Identität; `204`, oder `502`, wenn nur die Hälfte funktioniert hat |

Die API ist **nur über den nginx-Proxy auf `:8080`** erreichbar — Port `3000`
ist bewusst nicht auf dem Host veröffentlicht (nutze `docker-compose exec backend …`,
wenn du direkten Zugriff aus dem Netzwerk heraus brauchst).

**Auth-Verhalten:** Middleware auf jeder `/api/*`-Route außer den beiden Probes.
Ist der Cognito-Pool konfiguriert (das heißt: im Deployment), erhalten Anfragen
ohne gültiges ID-Token `401 {"error":"Unauthorized"}`. Ist er nicht konfiguriert
(lokale Entwicklung), funktionieren die schreibgeschützten Routen weiter, die
Identitätsausgabe antwortet mit `401`, und die angemeldeten Funktionen antworten
mit **`501`**, statt es vorzutäuschen — das Backend protokolliert beim Start
zudem `auth_disabled`, sodass die Umgehung nie still ist.

```bash
curl http://localhost:8080/api/health
curl http://localhost:8080/api/ready
curl http://localhost:8080/api/games
curl http://localhost:8080/api/games/4

# with the pool configured, protected routes need the ID token:
curl -H "Authorization: Bearer $ID_TOKEN" http://localhost:8080/api/me
curl -H "Authorization: Bearer $ID_TOKEN" http://localhost:8080/api/scores/me
curl -H "Authorization: Bearer $ID_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"game":"Cyber Strike","score":42}' \
     http://localhost:8080/api/scores

# erasure (irreversible — it deletes the Cognito user as well):
curl -X DELETE -H "Authorization: Bearer $ID_TOKEN" http://localhost:8080/api/me
```

Oder führe die vollständige Prüfsuite aus: `make smoke`.

---

## 🗄️ Datenbank

GameHub verwendet **MySQL 8.4 in einem Container**, beim ersten Start eines leeren
Volumes automatisch aus [`db/init.sql`](db/init.sql) befüllt. So ist ein frischer
Clone ohne Cloud-Konto und ohne Secrets reproduzierbar — und der deployte Stack
führt denselben Container auf dem EC2-Host aus, sodass es genau ein
Datenbank-Setup gibt, über das man nachdenken muss. Der Umstieg auf RDS (Multi-AZ,
automatisierte Backups, verwaltetes Patching) ist ein bewusster Kosten-/Betriebs-
Trade-off für eine spätere Phase und keine hier erhobene Behauptung.

Setze dich jederzeit mit `make db-reset` auf einen sauberen vorbefüllten Zustand zurück.

Die Tabelle `games` enthält diese Felder:

| Spalte | Zweck |
|---|---|
| `id` | Spielkennung |
| `name` | Spieltitel |
| `category` | Kategorie, die von den Frontend-Filtern verwendet wird |
| `description` | Kurze Spielbeschreibung |

Beispielkategorien sind Action, Racing und Strategy.

### Spielerdaten (`personal_bests`)

| Spalte | Zweck |
|---|---|
| `user_sub` | Der Cognito-`sub` — **niemals** die E-Mail-Adresse |
| `game` | Spielname (gegen `games.name` validiert, also keine Freitextzeilen) |
| `score` | Nur der beste Punktestand (`GREATEST()` bei Konflikt) |
| `updated_at` | Wann dieser Bestwert zuletzt verbessert wurde |

Der Primärschlüssel ist `(user_sub, game)`: eine Zeile pro Spieler und Spiel, was
das gesamte Datenminimierungs-Argument ist. Spieler werden gegenüber der Datenbank
durch einen pseudonymen Cognito-`sub` identifiziert; keine E-Mail, kein Name, keine
IP wird neben einem Punktestand gespeichert.

### Migrationen

`db/init.sql` läuft **einmal**, auf einem leeren Daten-Volume — was für einen
frischen Clone korrekt und für eine Live-Datenbank falsch ist. Schemaänderungen
werden daher als Migrationen ausgeliefert:

```bash
./scripts/migrate.sh            # apply everything pending
./scripts/migrate.sh --status   # what is applied, what is pending
```

Jede Datei in [`db/migrations/`](db/migrations/) wird in einem
`schema_migrations`-Ledger mit einer **Prüfsumme** festgehalten. Eine Migration,
die angewendet und danach bearbeitet wurde, wird abgelehnt, weil die Datenbank, die
sie ausgeführt hat, nicht mehr durch die Datei beschrieben wird. Der Runner
erreicht MySQL auf einem Host über `docker compose exec` und in CI über den
`mysql`-Client (`MIGRATE_VIA`), sodass dasselbe Skript an beiden Orten läuft. Es ist
außerdem Teil des Deployments: Der Rollout bringt das Schema nach dem Start der
Container auf den aktuellen Stand.

Das Frontend ruft Spieldatensätze dynamisch über die Express-API ab, statt sich vollständig auf fest codierte Spielkarten zu verlassen.

---

## 🐳 Docker-Design

### Frontend-Container

- Verwendet Nginx Alpine.
- Liefert HTML, CSS und JavaScript aus.
- Lädt die benutzerdefinierte Nginx-Konfiguration.
- Leitet `/api/`-Anfragen an den Backend-Service weiter.

### Backend-Container

- Verwendet Node.js Alpine.
- Installiert die Anwendungsabhängigkeiten.
- Führt den Express-Server aus.
- Liest die Datenbankkonfiguration aus Umgebungsvariablen.
- Verbindet sich über das private Docker-Netzwerk mit dem MySQL-Container (kein veröffentlichter Host-Port).

### Docker Compose

Compose verwaltet beide Services und verbindet sie über das `gamehub-network`-Netzwerk.

Nützliche Befehle:

```bash
docker-compose ps
docker-compose restart
docker-compose up -d --build frontend
docker-compose up -d --build backend
docker-compose logs -f backend
docker-compose down
```

Baue einen Service nach einer Codeänderung neu:

```bash
docker-compose up -d --build frontend
```

Oder:

```bash
docker-compose up -d --build backend
```

---

## 🔐 Sicherheitspraktiken

- **Keine Secrets für die lokale Entwicklung erforderlich** — Compose-Standardwerte liegen im privaten Docker-Netzwerk; im Repo existiert nichts Sensibles.
- `.env` ist von Git **und** von Image-Builds ausgeschlossen (`backend/.dockerignore`); `backend/.env.example` dokumentiert jede Variable.
- Das Backend läuft als **Non-Root**-Benutzer und liest die gesamte Konfiguration aus Umgebungsvariablen (12-Faktor).
- Der API-Port ist **nicht** auf dem Host veröffentlicht — nur nginx auf `:8080` ist erreichbar.
- `npm ci` aus einer committeten Lockfile; der Abhängigkeitsbaum wird auditiert (**0 Schwachstellen** zum Zeitpunkt des Schreibens).

Härtung des Live-Deployments:

- **JWT-Verifikation statt Vertrauen**: Die API validiert die RS256-Signatur des
  Cognito-ID-Tokens gegen die JWKS des Pools mit `node:crypto` (kein SDK) und prüft
  anschließend `iss`, `aud`/`client_id`, `exp` und `token_use`. Ein gefälschtes,
  abgelaufenes, aus dem falschen Pool stammendes oder Nicht-ID-Token ergibt `401`
- **Sitzungsablauf wird client- und serverseitig durchgesetzt**: Der Guard behandelt
  ein abgelaufenes Token als abgemeldet, und die API würde es ohnehin ablehnen
- **Kein SSH auf dem EC2-Host**: Port 22 wird gar nicht geöffnet; die Security Group
  erlaubt 8080 nur von der von AWS verwalteten CloudFront-Origin-facing-Prefix-Liste,
  und die Administration erfolgt über SSM Session Manager / Run Command
- **IMDSv2 erforderlich**, One-Hop-Antwortlimit und ein verschlüsseltes `gp3`-Root-Volume
- **Keine langlebigen AWS-Anmeldedaten**: GitHub Actions übernimmt via OIDC eine
  Rolle, die auf dieses Repository, diesen Bucket, diese Distribution und diese
  Instanz beschränkt ist
- **Laufzeit-Secrets bleiben auf dem Host**: Die Cognito-IDs, die CORS-Origin und
  die Datenbankpasswörter des deployten Stacks werden von einem Root-only-`.env`
  im CloudFormation-User-Data-Skript geschrieben — nie in Git, nie in einem Image,
  und die Passwörter sind `NoEcho`-Parameter im Stack
- **CloudFront erzwingt HTTPS** für Betrachter, und der S3-Bucket ist privat mit
  einer Bucket-Policy, die nur diese Distribution zulässt (OAC)
- **Eine AWS-Berechtigung, ein ARN**: Die Inline-Policy der Instanzrolle erlaubt
  `cognito-idp:AdminDeleteUser` auf dem GameHub-User-Pool und nichts sonst — kein
  `CognitoPowerUser`, keine `*`-Ressource
- **Keine Drittanbieter-Requests aus dem Browser**: Die Fonts sind selbst gehostet
  (OFL), sodass das Laden einer Seite keine Besucher-IP an Google oder an einen
  Analytics-/CDN-Anbieter preisgibt. Das ist in der Praxis eine deutsche
  Datenschutzanforderung, keine Performance-Vorliebe

### Datenschutz (DSGVO)

- **Datenminimierung durch das Schema**: eine `(user_sub, game)`-Zeile pro Spieler
  mit dem besten Punktestand — keine Spielhistorie, keine E-Mail in der
  Punkte-Tabelle, keine IP neben einem Punktestand
- **Speicherbegrenzung**: Zugriffslogs werden 7 Tage aufbewahrt und dann
  automatisch gelöscht; die Aufbewahrung wird auf den Log-Gruppen in
  `infra/observability.yaml` gesetzt und der Grund im Hinweis niedergeschrieben
- **Löschung (Art. 17)**: `DELETE /api/me` entfernt die Datenbankzeilen und die
  Cognito-Identität. Die Reihenfolge ist wichtig — zuerst die Zeilen —, denn würde
  die Identität zuerst gelöscht, hinterließe ein Fehler Daten, die niemand
  (auch nicht der Nutzer) je löschen könnte. Ein Cognito-Fehler liefert `502` mit
  einer wahrheitsgemäßen Meldung
- **Auskunft & Portabilität (Art. 15, 20)**: Die Kontoseite listet die Identität
  und jede gespeicherte Zeile, mit Ein-Klick-JSON-Export
- **Transparenz (Art. 13)**: [`frontend/privacy.html`](frontend/privacy.html)
  ist ein zweisprachiges Inventar — Eintrag, Zweck, Rechtsgrundlage, Aufbewahrung,
  Auftragsverarbeiter (AWS, `eu-central-1`) und Rechte
- **Bewusst nicht gespeichert**: Passwörter (Cognito hält einen gesalzenen Hash,
  den wir nie sehen), Werbe-Identifikatoren, Verhaltensprofile, Drittanbieter-Analytics

### Supply Chain & Pipeline

- **SBOM pro Build**: ein SPDX-JSON-Inventar (syft) wird in CI erzeugt und als
  Build-Artefakt aufbewahrt
- **Zwei Schwachstellen-Scans, zwei Fragen**: Trivy über das Dateisystem (Quellcode
  und Abhängigkeiten) *und* über das **gebaute Image** (was das Basis-Image
  hinzufügt), plus `npm audit` — alle lassen den Job bei `CRITICAL`/`HIGH` fehlschlagen
- **Secret-Scanning über die Historie**, nicht nur über den Diff: gitleaks läuft
  gegen die vollständige Git-Historie, weil ein Secret, das committet und wieder
  entfernt wurde, trotzdem geleakt ist
- **Dependabot** für npm, GitHub Actions und Basis-Images: Aktualisierungen kommen
  als überprüfbare Pull Requests, die dasselbe CI bestehen müssen, ohne Auto-Merge
- **Das Deployment ist an CI gekoppelt, nicht an den Push**: `.github/workflows/deploy.yml`
  wird durch einen *erfolgreichen CI-Lauf* für einen bestimmten Commit ausgelöst und
  checkt **diesen** Commit aus, sodass ein Merge die Produktion nicht erreichen kann,
  bevor die Tests ihn beurteilt haben
- **Post-Deploy-Verifikation gegen die öffentliche URL**: Die Pipeline endet mit der
  Prüfung der Homepage, aller 12 Katalogeinträge über die API, der Spieldetails per
  ID und dass ein nicht authentifiziertes `/api/me` `401` liefert — das Edge, nicht
  nur der Host
- **Branch-Schutz auf `main`**: Die vier CI-Jobs sind erforderliche Status-Checks
  im Strict-Modus, Administratoren sind nicht ausgenommen, Force-Pushes und das
  Löschen des Branches sind deaktiviert, und ungelöste Konversationen blockieren
  den Merge. Das Gate ist nur dann ein Gate, wenn der Merge selbst gegated ist

---

## 🧪 Test-Checkliste

- [x] Startseite lädt erfolgreich. *(Smoke-Check)*
- [ ] Navigation zwischen Home und Games funktioniert.
- [ ] Links zu Tournaments und Leaderboard führen zu den vorgesehenen Abschnitten.
- [x] Games-Seite lädt den Katalog (12 vorbefüllte Spiele). *(im Browser verifiziert)*
- [ ] Kategoriefilter zeigen die erwarteten Spiele an.
- [x] Liveness-Endpunkt des Backends antwortet. *(Smoke-Check)*
- [x] Readiness-Endpunkt des Backends meldet den Datenbankzustand. *(Smoke-Check)*
- [x] Games-API gibt Datenbankdatensätze zurück. *(Smoke-Check)*
- [x] Nginx proxyt API-Anfragen erfolgreich. *(Smoke-Check auf :8080)*
- [x] Unbekannte Routen liefern saubere JSON-404s. *(Smoke-Check)*
- [x] Backend-Port ist vom Host nicht erreichbar. *(verifiziert: Verbindung abgelehnt)*
- [x] Datenbank-Zugangsdaten bleiben ungetrackt (Git **und** Image-Builds).
- [x] Ein sauberer Rebuild + Reseed funktioniert über `make bootstrap`. *(verifiziert: vollständiger Teardown → Smoke bestanden)*
- [x] Alle 12 Katalogeinträge öffnen ein echtes Spiel. *(Engines in CI getestet + Stichproben im Browser)*
- [x] Spiel-Engines überstehen Hunderte von Frames und erreichen ihre Endzustände. *(21 Frontend-Tests)*
- [x] Jedes vorbefüllte Spiel ist einer Engine zugeordnet (keine toten Katalogeinträge). *(Mapping-Contract-Test)*
- [x] Cognito-Tokens werden serverseitig verifiziert; schlechte/abgelaufene/aus falschem Pool stammende Tokens erhalten 401. *(12 Auth-Tests)*
- [x] Anmelde-Gate bleibt offen (mit lauter Startwarnung), wenn kein Pool konfiguriert ist. *(Auth-Test)*
- [x] Live-Website auf S3 + CloudFront deployt, API über CloudFront `/api/*` erreichbar. *(live verifiziert)*
- [x] Deployment ist schlüssellos: GitHub Actions übernimmt eine Rolle via OIDC. *(Deploy-Workflow)*
- [x] Strukturierte JSON-Access-Logs erreichen CloudWatch Logs. *(mit Logs Insights verifiziert)*
- [x] Aus Logs abgeleitete Metriken erzeugen Datenpunkte. *(mit `get-metric-statistics` verifiziert)*
- [x] Der synthetische Check läuft planmäßig und sein Ergebnis ist eine Metrik, nicht nur eine Logzeile. *(live verifiziert)*
- [x] Jeder Alarm hat einen echten Zustand und ein Benachrichtigungsziel. *(mit `describe-alarms` verifiziert)*
- [x] Die App läuft auf Kubernetes aus denselben Images. *(auf kind verifiziert; Smoke-Test auf :8081 bestanden)*
- [x] Manifeste sind gültig und der generierte DB-Seed stimmt mit `db/init.sql` überein. *(kubeconform + Drift-Check in CI)*
- [x] Argo CD meldet die Application als `Synced`/`Healthy` und setzt manuellen Drift zurück. *(auf kind verifiziert)*
- [x] Rolling Updates fallen nie unter die deklarierte Replica-Zahl. *(`maxUnavailable: 0`)*
- [x] Die Punktestände eines Spielers werden serverseitig gespeichert, eine Zeile pro Spiel, nur der Bestwert. *(DSGVO-Test: Upsert-Semantik)*
- [x] Ein Spieler kann jede über ihn gespeicherte Zeile abrufen. *(DSGVO-Test: `/api/scores/me`)*
- [x] Die Abfrage eines Spielers liefert die Zeilen keines anderen. *(DSGVO-Test: Zeilen-Isolation)*
- [x] Die Kontolöschung entfernt die DB-Zeilen **und** die Cognito-Identität. *(DSGVO-Test: SigV4 `AdminDeleteUser` geprüft)*
- [x] Ein Cognito-Fehler löscht die Daten dennoch und meldet ein Teilergebnis (`502`). *(DSGVO-Test)*
- [x] Die Identität kann nicht durch eine Anfrage gelöscht werden, bei der kein Pool konfiguriert ist. *(Open-Mode-Test: `501`)*
- [x] Signaturen sind echt: Sitzungstokens sind signiert, und ein geänderter Body ändert die Signatur. *(10 Signer-Tests)*
- [x] Migrationen werden einmal angewendet, sind idempotent und werden abgelehnt, wenn sie umgeschrieben werden. *(CI führt den Runner zweimal aus)*
- [x] Das gebaute Image wird gescannt, nicht nur der Quellbaum. *(Trivy-Image-Scan in CI)*
- [x] Ein Abhängigkeitsinventar (SBOM) wird bei jedem Build erzeugt. *(syft, SPDX-JSON-Artefakt)*
- [x] Die Produktion erhält nur einen Commit, den CI bestanden hat, und das Deployment wird am Edge smoke-getestet. *(Deploy-Workflow `workflow_run` + `verify`)*

---

## 📚 Demonstrierte Fähigkeiten

- Integration von Frontend und Backend
- REST-API-Entwicklung
- Konnektivität zu relationalen Datenbanken
- MySQL-Schema-Bootstrap und -Befüllung
- Erstellung von Docker-Images
- Orchestrierung von Anwendungen mit mehreren Containern
- Kommunikation in Docker-Netzwerken
- Konfiguration von Nginx als Reverse Proxy
- Umgebungsbasierte Konfiguration
- Healthcheck-gesteuerter Container-Start (geordnetes Warten auf Abhängigkeiten)
- Design von Liveness- vs. Readiness-Probes
- Connection Pooling
- Non-Root-Container-Images **ohne Paketmanager in der Laufzeit**, Basis-Images auf dem Stable-Kanal mit Security-Patches zur Build-Zeit, auditierte Lockfiles
- Ein-Befehl-Bootstrap + Smoke-Testing
- Automatisiertes Testen (Unit + Integration) mit Coverage-Gates
- CI/CD-Pipelines (GitHub Actions): Lint → Test → Build → Security-Scan
- Security-Scans für Abhängigkeiten und Images (Trivy, npm audit, gitleaks)
- DSGVO-bewusstes Frontend: selbst gehostete Assets, null Drittanbieter-Requests
- Canvas-basierte UI-Animation und Spieleentwicklung (6 Engines, Game-Loop-Design)
- Testen von Grafikcode ohne Browser (gestubbtes Canvas, frame-getriebene Tests)
- Canvas-basierte UI-Animation mit Unterstützung für Barrierefreiheit (Reduced Motion)
- Identität und Zugriff: Cognito-User-Pools, ID-Tokens, JWKS-basierte JWT-Verifikation
- Schlüssellose CI/CD: GitHub-Actions-OIDC-Föderation und Deploy-Rollen nach dem Least-Privilege-Prinzip
- Infrastruktur als Code: fünf CloudFormation-Stacks mit Cross-Stack-Outputs
- Statisches Hosting und CDN-Design: privates S3 + CloudFront OAC, aufgeteiltes Cache-Verhalten
- Observability: strukturierte JSON-Logs, aus Logs abgeleitete Metriken, Metric Math auf einem Dashboard
- Synthetisches (Black-Box-)Verfügbarkeits-Monitoring mit Alarm-Semantik, die Stille als Ausfall behandelt
- Alarm-Design: 8 umsetzbare Alarme, SNS-Benachrichtigungspfad, pro Signal gewähltes `TreatMissingData`
- SLOs und Error Budgets, vor dem Vorfall geschrieben, mit einem Runbook pro Alarm
- Kubernetes: Deployments vs. StatefulSets, benannte Ports, Probes, Resource Requests/Limits
- Container Security Context: aus Evidenz gewählte Capability-Drop-Listen, seccomp, Non-Root
- GitOps mit Argo CD: automatischer Sync, Prune, selfHeal, Drift als zurückzusetzender Bug
- Lokales Cluster-Engineering: kind, side-geladene Images, NodePort-Mapping, PVC-Scope
- Host-Härtung: SSM-only-Administration, IMDSv2, auf Prefix-Listen beschränkter Ingress
- Datenschutz als Code: DSGVO Art. 15/17/20 als Endpunkte umgesetzt, nicht als Richtlinientext
- Löschung über zwei Systeme mit definiertem Fehlermodus (Teillöschung als Teil gemeldet)
- AWS-Request-Signierung von Hand (SigV4) und Instanzmetadaten-Zugangsdaten (IMDSv2), kein SDK
- IAM Least Privilege: eine Aktion, auf ein Ressourcen-ARN beschränkt
- Datenminimierung im Schema-Design (eine Zeile pro Spieler und Spiel, pseudonymer Schlüssel)
- Datenbankmigrationen mit Prüfsummen-Ledger; Idempotenz in CI verifiziert
- Supply Chain: SBOM-Erzeugung, Schwachstellen-Scanning auf Image-Ebene, Dependabot, Secret-Scanning über die Historie
- CI-gated Deployment: Die Produktion erhält nur den Commit, den CI bestanden hat, danach ein Post-Deploy-Smoke-Test am Edge
- Git- und GitHub-Workflows
- Fehlerbehebung in Anwendungen

---

## 🗺️ Roadmap

| Phase | Fokus | Status |
|---|---|---|
| **0** | Reproduzierbare lokale Grundlage (Compose, Seed, Healthchecks, `make bootstrap`, Smoke-Tests) | ✅ 2026-10-18 |
| **1** | Automatisierte Tests + GitHub-Actions-CI (Lint, Coverage-Gate, Trivy, gitleaks) | ✅ 2026-10-18 |
| **2** | Spielerische UI: live-animierter Hintergrund, selbst gehostete Game-Fonts, Arcade-Styling | ✅ 2026-10-18 |
| **3** | Echte spielbare Spiele — jeder Katalogeintrag öffnet ein Spiel | ✅ 2026-10-19 |
| **4** | Auth & Live: Cognito (Anmelde-Gate), S3 + CloudFront, EC2-Backend, CloudFormation + OIDC-CD | ✅ 2026-10-19 |
| **5** | Observability: strukturierte Logs, Metriken aus Logs, synthetischer Check, 8 Alarme, Dashboard, SLOs, Runbook | ✅ 2026-10-19 |
| **6** | Lokales Kubernetes (kind) + Argo CD GitOps | ✅ 2026-10-19 |
| **7** | Security- & DSGVO-Härtung: Kontolöschung (Art. 17) über DB + Cognito, SigV4 ohne SDK, Migrationen mit Prüfsummen-Ledger, SBOM + Image-Scanning, CI-gated Deploys | ✅ 2026-10-19 |
| **8** | /learn-Dokumentationsseite + PDF-Export + Lasttest-Bericht | ✅ 2026-10-19 |

---

## 👨‍💻 Autor

**Cijo Stany John**

GameHub ist ein fortlaufendes Lern- und Portfolio-Projekt, das geschaffen wurde, um AWS-Cloud-Architektur, Backend-Entwicklung, Containerisierung und DevOps-Deployment-Workflows zu üben.

---

*Gebaut mit Neugier, Containern und einer Leidenschaft fürs Gaming.* 🎮
