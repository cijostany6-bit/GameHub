# 🎮 GameHub

> 🇬🇧 [English version](README.md) | 🇩🇪 Deutsche Version

### Eine futuristische Gaming-Plattform, gebaut mit AWS & DevOps

[![CI](https://github.com/cijostany6-bit/GameHub/actions/workflows/ci.yml/badge.svg)](https://github.com/cijostany6-bit/GameHub/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![Tests](https://img.shields.io/badge/tests-64%20passing-brightgreen)
![Coverage](https://img.shields.io/badge/coverage-%E2%89%A580%25%20gated-blue)

GameHub ist ein Portfolio-Projekt, das eine futuristische Gaming-Oberfläche mit einem containerisierten Node.js-Backend und einer MySQL-Datenbank kombiniert — alles lokal mit einem einzigen Befehl lauffähig. Es zeigt, wie Frontend-Anwendungen, Backend-APIs, Container-Netzwerke, Reverse Proxies, Datenbanken, Tests und CI-Pipelines zusammenspielen.

Das Projekt wird zu einer Anwendung im Produktionsstil weiterentwickelt: automatisierte CI/CD, Infrastruktur als Code auf AWS, Monitoring und Kubernetes (lokaler kind-Cluster + Argo CD).

> **Status — Phase 4 abgeschlossen (2026-10-19):** getestet, in CI, spielerisch,
> spielbar und **live auf AWS**. 64 automatisierte Tests, ein Cognito-Anmelde-Gate,
> die statische Website auf S3 + CloudFront, die API auf EC2, alles als
> CloudFormation beschrieben und per schlüssellosem GitHub-OIDC deployt.

**Live-Demo:** <https://d2qf9zxehny6bk.cloudfront.net> — lege ein Konto an
(E-Mail-Bestätigung), melde dich an und spiele. Die Landing Page ist öffentlich;
der Katalog und die Spiele erfordern einen angemeldeten Spieler.

---

## 📌 Projektstatus

**Aktuelle Phase:** Phase 0 — reproduzierbare lokale Grundlage ✅

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
- Dockerisiertes Frontend und Backend mit **gepinnten Basis-Images**, `npm ci` aus der Lockfile, **0 npm-Schwachstellen**, Backend läuft als **Non-Root**
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

### 🚧 Geplant

- **Phase 5 — Observability**: Metriken, Dashboards, Alarme, Runbooks, SLOs
- **Phase 6 — lokales Kubernetes (kind) + Argo CD GitOps**
- **Phase 7 — Security- & DSGVO-Härtung** (Löschvorgang für Daten, SBOM)
- **Phase 8 — /learn-Dokumentationsseite, PDF-Export, Lasttest-Bericht**

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
│   ├── script.js           ← homepage + catalogue logic
│   ├── play.js             ← runner: ENGINE_MAP, HUD, high scores
│   ├── engines.js          ← 6 dependency-free canvas game engines
│   ├── auth.js             ← Cognito REST client, session, page guard
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
│   ├── app.js              ← Express app (exported for tests)
│   ├── server.js           ← HTTP entrypoint
│   ├── test/               ← unit, integration and auth suites
│   ├── package.json
│   └── package-lock.json
├── db/
│   └── init.sql            ← schema + seed (runs on first boot)
├── infra/
│   ├── cognito.yaml        ← user pool + app client
│   ├── site.yaml           ← S3 + CloudFront (+ /api/* origin)
│   ├── backend.yaml        ← EC2 host, security group, IAM, elastic IP
│   └── github-oidc.yaml    ← OIDC provider + scoped deploy role
├── scripts/
│   ├── smoke.sh            ← end-to-end checks
│   ├── build-frontend.sh   ← builds the deployable static artifact
│   └── deploy-frontend.sh  ← S3 sync + CloudFront invalidation
├── .github/workflows/
│   ├── ci.yml              ← lint, tests, coverage, compose smoke, scans
│   └── deploy.yml          ← OIDC deploy (site + API host)
├── docs/                   ← step-by-step learning notes
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
make help             # list all targets
```

Lieber reines Compose? `docker-compose up -d --build` und dann `./scripts/smoke.sh` bewirkt dasselbe.

---

## ☁️ Auf AWS deployen

Alles ist CloudFormation in [`infra/`](infra/) — vier kleine Stacks, jeder mit
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
```

Für Continuous Deployment deploye den vierten Stack
(`infra/github-oidc.yaml`) einmal und setze dann diese GitHub-Repository-Variablen
und pushe nach `main` — der [Deploy-Workflow](.github/workflows/deploy.yml)
erledigt den Rest über OIDC, ohne dass irgendwo AWS-Schlüssel gespeichert sind:

`AWS_REGION`, `AWS_DEPLOY_ROLE_ARN`, `SITE_BUCKET`, `DISTRIBUTION_ID`,
`INSTANCE_ID`, `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`.

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

Die API ist **nur über den nginx-Proxy auf `:8080`** erreichbar — Port `3000`
ist bewusst nicht auf dem Host veröffentlicht (nutze `docker-compose exec backend …`,
wenn du direkten Zugriff aus dem Netzwerk heraus brauchst).

**Auth-Verhalten:** Middleware auf jeder `/api/*`-Route außer den beiden Probes.
Ist der Cognito-Pool konfiguriert (das heißt: im Deployment), erhalten Anfragen
ohne gültiges ID-Token `401 {"error":"Unauthorized"}`. Ist er nicht konfiguriert
(lokale Entwicklung), laufen die Anfragen durch und das Backend protokolliert beim
Start `auth_disabled` — die App ist also nie kaputt, aber die Umgehung ist auch nie still.

```bash
curl http://localhost:8080/api/health
curl http://localhost:8080/api/ready
curl http://localhost:8080/api/games
curl http://localhost:8080/api/games/4

# with the pool configured, protected routes need the ID token:
curl -H "Authorization: Bearer $ID_TOKEN" http://localhost:8080/api/me
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

Die aktuelle Spieltabelle enthält diese Felder:

| Spalte | Zweck |
|---|---|
| `id` | Spielkennung |
| `name` | Spieltitel |
| `category` | Kategorie, die von den Frontend-Filtern verwendet wird |
| `description` | Kurze Spielbeschreibung |

Beispielkategorien sind Action, Racing und Strategy.

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
- Non-Root-Container-Images, gepinnte Basis-Images, auditierte Lockfiles
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
- Infrastruktur als Code: vier CloudFormation-Stacks mit Cross-Stack-Outputs
- Statisches Hosting und CDN-Design: privates S3 + CloudFront OAC, aufgeteiltes Cache-Verhalten
- Host-Härtung: SSM-only-Administration, IMDSv2, auf Prefix-Listen beschränkter Ingress
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
| **5** | Observability: Metriken, Dashboards, Alarme, Runbooks, SLOs | ⏭️ als Nächstes |
| **6** | Lokales Kubernetes (kind) + Argo CD GitOps | Geplant |
| **7** | Security- & DSGVO-Härtung (Löschvorgang, SBOM) | Geplant |
| **8** | /learn-Dokumentationsseite + PDF-Export + Lasttest-Bericht | Geplant |

---

## 👨‍💻 Autor

**Cijo Stany John**

GameHub ist ein fortlaufendes Lern- und Portfolio-Projekt, das geschaffen wurde, um AWS-Cloud-Architektur, Backend-Entwicklung, Containerisierung und DevOps-Deployment-Workflows zu üben.

---

*Gebaut mit Neugier, Containern und einer Leidenschaft fürs Gaming.* 🎮
