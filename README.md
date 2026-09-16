# 🎮 GameHub

GameHub is a futuristic gaming and tournament platform being built as a portfolio-level **AWS + DevOps project**.

The project is designed to demonstrate the complete journey of a modern application:

**Development → Git/GitHub → Docker → AWS → CI/CD → Kubernetes → Monitoring → Security**

---

## 🚧 Project Status

**Current Phase:** Application foundation + Dockerization

**Progress:** In Development

### Completed

- [x] GameHub frontend foundation
- [x] Futuristic gaming UI
- [x] Node.js + Express backend
- [x] AWS RDS MySQL database
- [x] Games database table
- [x] Backend API for retrieving games
- [x] Backend health-check API
- [x] Dockerized frontend
- [x] Dockerized backend
- [x] Docker Compose
- [x] Dedicated Docker network
- [x] Nginx reverse proxy
- [x] Frontend → Backend → RDS integration
- [x] Environment-variable based database credentials
- [x] Git/GitHub repository setup

### Planned

- [ ] Dedicated Games page
- [ ] Dynamic game catalogue
- [ ] Game categories and filtering
- [ ] Game details
- [ ] Tournament system
- [ ] Leaderboard system
- [ ] User authentication
- [ ] Additional backend APIs
- [ ] Docker Hub deployment
- [ ] AWS application deployment
- [ ] Kubernetes deployment
- [ ] Jenkins CI/CD pipeline
- [ ] Monitoring and logging
- [ ] Security hardening
- [ ] Final testing
- [ ] Production-style deployment

---

# 🏗️ Architecture

Current architecture:

```text
                         ┌──────────────────┐
                         │     Browser      │
                         └────────┬─────────┘
                                  │
                                  │ :8080
                                  ▼
                         ┌──────────────────┐
                         │ Frontend Nginx   │
                         │    Container     │
                         └────────┬─────────┘
                                  │
                         /api/*   │
                                  ▼
                    ┌─────────────────────────┐
                    │    Docker Network       │
                    │    gamehub-network      │
                    └────────────┬────────────┘
                                 │
                                 ▼
                         ┌──────────────────┐
                         │ Node.js Backend  │
                         │    Container     │
                         │      :3000       │
                         └────────┬─────────┘
                                  │
                                  │ MySQL
                                  ▼
                         ┌──────────────────┐
                         │    AWS RDS       │
                         │      MySQL       │
                         └──────────────────┘