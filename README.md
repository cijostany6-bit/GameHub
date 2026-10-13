# 🎮 GameHub

### A Futuristic Gaming Platform Built with AWS & DevOps

GameHub is a portfolio project that combines a futuristic gaming interface with a containerized Node.js backend and an AWS RDS MySQL database. It demonstrates how frontend applications, backend APIs, container networking, reverse proxies, and cloud databases work together.

The long-term goal is to evolve GameHub into a production-style application with automated CI/CD, cloud deployment, monitoring, and Kubernetes.

---

## 📌 Project Status

**Current phase:** Application foundation and Dockerization

**Status:** Core application running locally with AWS RDS integration.

### ✅ Completed

- Futuristic gaming homepage
- Dedicated Games page
- Dynamic game catalogue loaded through a backend API
- Game category filters
- Frontend built with HTML, CSS, and JavaScript
- Node.js and Express backend
- AWS RDS MySQL database integration
- Games database table and sample records
- Backend health-check endpoint
- Dockerized frontend and backend
- Docker Compose orchestration
- Dedicated Docker network
- Nginx reverse proxy for API requests
- Environment-variable-based database credentials
- Frontend-to-backend-to-database integration
- Git and GitHub repository setup
- Reproducible Docker build and startup workflow

### 🚧 Planned

- Game detail pages and playable game integration
- Tournament functionality
- Leaderboards backed by database records
- User authentication and authorization
- Additional backend APIs
- Docker Hub image publishing
- AWS application deployment
- HTTPS and domain configuration
- Jenkins CI/CD pipeline
- Kubernetes deployment
- Monitoring, logging, and alerting
- Security hardening
- Production-style testing and deployment

---

## 🏗️ Architecture

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
                       AWS RDS
                       MySQL DB
```

### Request flow

1. A user opens GameHub in the browser.
2. Nginx serves the static frontend files.
3. JavaScript sends API requests to the frontend's `/api/` path.
4. Nginx forwards those requests to the backend container.
5. Express processes the request and queries AWS RDS MySQL.
6. The backend returns JSON, which the frontend uses to render game cards.

**Important:** The browser accesses the frontend through port `8080`. The Nginx container communicates with the backend using Docker networking. The database remains hosted on AWS RDS.

---

## 🧰 Technology Stack

| Technology | Purpose |
|---|---|
| HTML5 | Frontend structure |
| CSS3 | Styling and responsive visual design |
| JavaScript | UI interactions, API requests, and category filters |
| Node.js | Backend JavaScript runtime |
| Express.js | REST API |
| MySQL | Relational database |
| Amazon RDS | Managed MySQL database hosting |
| Docker | Application containerization |
| Docker Compose | Multi-container orchestration |
| Nginx | Static web server and reverse proxy |
| Git | Version control |
| GitHub | Source code hosting |
| Colima | Local Docker runtime on macOS |

---

## 📁 Project Structure

```text
GameHub/
├── frontend/
│   ├── index.html
│   ├── games.html
│   ├── script.js
│   ├── style.css
│   └── nginx.conf
├── backend/
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── .env
│   ├── package.json
│   ├── package-lock.json
│   └── server.js
├── Dockerfile
├── docker-compose.yml
├── .gitignore
└── README.md
```

**Security note:** `backend/.env` contains local database configuration and must not be committed to GitHub. The `.gitignore` file excludes `.env` and `node_modules`.

---

## 🚀 Run GameHub Locally

### Prerequisites

- macOS or Linux
- Git
- Docker CLI
- A working Docker runtime
- Docker Compose
- Network access to the configured AWS RDS database

On this Mac, GameHub uses Colima as its Docker runtime and the `docker-compose` command.

### 1. Clone the repository

```bash
git clone https://github.com/cijostany6-bit/GameHub.git
cd GameHub
```

### 2. Configure database credentials

Create `backend/.env` locally with the following variables:

```env
DB_HOST=YOUR_RDS_ENDPOINT
DB_PORT=3306
DB_USER=YOUR_DB_USERNAME
DB_PASSWORD=YOUR_DB_PASSWORD
DB_NAME=YOUR_DATABASE_NAME
```

Replace the placeholders with your own database configuration. Never publish actual credentials.

### 3. Verify database connectivity

Ensure that:

- The RDS instance is available.
- The RDS security group allows MySQL traffic from the appropriate source.
- The database name and credentials are correct.
- The client machine or Docker runtime can reach the RDS endpoint.

Do not open MySQL to the entire internet as a troubleshooting shortcut.

### 4. Build and start the application

```bash
docker-compose up -d --build
```

### 5. Check container status

```bash
docker-compose ps
```

### 6. View application logs

```bash
docker-compose logs --tail=100
```

Backend logs only:

```bash
docker-compose logs --tail=100 backend
```

Frontend logs only:

```bash
docker-compose logs --tail=100 frontend
```

### 7. Open GameHub

Visit:

**http://localhost:8080**

### 8. Stop the application

```bash
docker-compose down
```

This removes the Compose-managed containers and network. It does not delete the separately hosted AWS RDS instance.

---

## 🔌 Backend API

The following endpoints are implemented in the current application.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Check backend health |
| GET | `/api/games` | Retrieve games from the database |

Test the health endpoint:

```bash
curl http://localhost:3000/api/health
```

Retrieve the games catalogue:

```bash
curl http://localhost:3000/api/games
```

The backend is also accessible through Nginx:

```bash
curl http://localhost:8080/api/health
curl http://localhost:8080/api/games
```

The port `3000` mapping is for local development and testing. In a production deployment, the backend should generally be accessible only through the intended application network or load-balancing layer.

---

## 🗄️ Database

GameHub uses Amazon RDS for MySQL.

The current games table contains these fields:

| Column | Purpose |
|---|---|
| `id` | Game identifier |
| `name` | Game title |
| `category` | Category used by the frontend filters |
| `description` | Short game description |

Sample categories include Action, Racing, and Strategy.

The frontend retrieves game records dynamically through the Express API rather than relying entirely on hardcoded game cards.

---

## 🐳 Docker Design

### Frontend container

- Uses Nginx Alpine.
- Serves HTML, CSS, and JavaScript.
- Loads the custom Nginx configuration.
- Forwards `/api/` requests to the backend service.

### Backend container

- Uses Node.js Alpine.
- Installs application dependencies.
- Runs the Express server.
- Reads database configuration from environment variables.
- Connects to AWS RDS MySQL.

### Docker Compose

Compose manages both services and connects them through the `gamehub-network` network.

Useful commands:

```bash
docker-compose ps
docker-compose restart
docker-compose up -d --build frontend
docker-compose up -d --build backend
docker-compose logs -f backend
docker-compose down
```

Rebuild a service after changing its code:

```bash
docker-compose up -d --build frontend
```

Or:

```bash
docker-compose up -d --build backend
```

---

## 🔐 Security Practices

- Database credentials are stored in a local environment file.
- `.env` and `node_modules` are excluded from Git.
- Backend code reads the database password from an environment variable.
- Database connectivity should be restricted through appropriate network and security-group rules.
- Public repository commits must be reviewed for credentials, tokens, and other sensitive information.

For a future production deployment, use a managed secrets solution such as AWS Secrets Manager or AWS Systems Manager Parameter Store where appropriate.

---

## 🧪 Testing Checklist

- [ ] Homepage loads successfully.
- [ ] Home and Games navigation works.
- [ ] Tournaments and Leaderboard links navigate to their intended sections.
- [ ] Games page loads the catalogue.
- [ ] Category filters display the expected games.
- [ ] Backend health endpoint responds.
- [ ] Games API returns database records.
- [ ] Nginx successfully proxies API requests.
- [ ] Both containers start after a clean Compose rebuild.
- [ ] Database credentials remain untracked.
- [ ] A fresh clone can be configured and started using this guide.

---

## 📚 Skills Demonstrated

- Frontend and backend integration
- REST API development
- Relational database connectivity
- AWS RDS configuration
- Docker image creation
- Multi-container application orchestration
- Docker network communication
- Nginx reverse proxy configuration
- Environment-based configuration
- Git and GitHub workflows
- Application troubleshooting

---

## 🗺️ Roadmap

**Phase 1 — Application foundation:** Completed

**Phase 2 — Dockerization and local integration:** Core workflow working

**Phase 3 — Documentation, testing, and repository cleanup:** In progress

**Phase 4 — AWS application deployment:** Planned

**Phase 5 — Jenkins CI/CD:** Planned

**Phase 6 — Kubernetes deployment:** Planned

**Phase 7 — Monitoring, logging, and security hardening:** Planned

---

## 👨‍💻 Author

**Cijo Stany John**

GameHub is an evolving learning and portfolio project built to practise AWS cloud architecture, backend development, containerization, and DevOps deployment workflows.

---

*Built with curiosity, containers, and a passion for gaming.* 🎮
