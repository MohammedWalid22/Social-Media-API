# 🚀 Advanced Social Media REST API
### Enterprise-Level Backend Architecture by **Mohammed Walid**

![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)
![Express.js](https://img.shields.io/badge/Express.js-404D59?style=for-the-badge)
![MongoDB](https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)
![Google Cloud](https://img.shields.io/badge/Google_Cloud-4285F4?style=for-the-badge&logo=google-cloud&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2CA5E0?style=for-the-badge&logo=docker&logoColor=white)
![Jest](https://img.shields.io/badge/Jest-C21325?style=for-the-badge&logo=jest&logoColor=white)

A tremendously robust, secure, and feature-rich RESTful API architected for a modern **Social Media Platform**. This backend handles complex social graphs, AI-driven content moderation, real-time gamification, and advanced session security.

---

## 🔥 Enterprise Features Implemented

### 🛡️ 1. AI-Driven Moderation & Safety
- **Report & Ticket System**: Full-scale reporting pipeline for users, posts, and comments with moderator resolution workflows.
- **AI Content Analysis:** Integration with `Google Cloud Natural Language` for automatic toxicity detection and sentiment scoring.
- **Personal Content Filters:** Regex-based "Muted Words" and phrases scanning to clean user feeds dynamically.

### 🍱 2. Advanced Social Engine
- **Groups & Communities:** Robust membership logic with public/private visibility and admin control.
- **Collaborative Posts:** Multi-author publishing with invitation/acceptance state machines.
- **Nested Threaded Comments:** Unlimited depth for conversational replies.
- **Multi-Reactions:** Facebook-style reactions (`Like`, `Love`, `Laugh`, `Angry`, `Sad`) implemented with high-performance indexing.

### 🎮 3. Real-Time Engagement & Gamification
- **Gamification Service:** Automated points engine rewarding user interactions.
- **Milestone Badges:** Dynamic awarding of achievements (`Active Member`, `Top Commenter`, `Popular Writer`).
- **Audio Transcription:** Automatic Speech-to-Text for voice comments via `Google Cloud Speech` service.

### 🔒 4. Elite Security & Session Management
- **Device Fingerprinting:** Tracking and verifying `User-Agent` and device IDs to detect suspicious activity.
- **Global Logout:** Securely invalidate all active sessions across all devices for a specific user.
- **Advanced Rate Limiting:** Strategic `Redis`-backed limits to prevent API abuse and DDoS attempts.

### ⚡ 5. Hyper Performance & Caching
- **Redis Caching:** Lightning-fast feed generation and frequency control for expensive operations.
- **Dockerized Infrastructure:** Full containerization for 1-click deployments (`API`, `MongoDB`, `Redis`).
- **Clean Architecture:** Service-based controllers separating logic from transport layers.

### 📈 6. Telemetry & Quality Assurance
- **Interactive Swagger UI:** Professionally mapped API documentation available at `/api/v1/docs`.
- **Winston & Morgan Logging:** Multi-level file-based logging for precise error tracking and health monitoring.
- **Automated Test Coverage:** `Jest` & `Supertest` suite executing **25 mandatory integration tests** in RAM-isolated environments.

---

## 🛠️ Tech Stack Outline
- **Runtime & Framework:** Node.js (Express.js)
- **Database & Caching:** MongoDB (Mongoose), Redis
- **AI Services:** Google Cloud NLP, Speech-to-Text
- **Security:** JWT (Access/Refresh), Crypto, Helmet, XSS-Clean
- **Documentation:** Swagger JSDoc
- **Testing:** Jest, Supertest, MongoMemoryServer

---

## 🚀 Quick Start (Zero Config via Docker)

The absolutely fastest way to run this entire server:

```bash
git clone https://github.com/MohammedWalid22/social-media-backend.git
cd social-media-backend

# Spin up the API, MongoDB, and Redis simultaneously!
docker-compose up --build
```

---

## 📡 Essential Endpoints & Swagger

Access the Interactive Documentation here when running locally:
👉 `http://localhost:3000/api/v1/docs`

#### Core API Highlights:
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/v1/reports` | Submit AI-ready violation reports |
| `POST` | `/api/v1/groups` | Initialize high-engagement communities |
| `POST` | `/api/v1/auth/logout-all` | Securely kill all active sessions |
| `POST` | `/api/v1/comments/:id/react` | Multi-type reaction engine (Like/Love/etc) |
| `GET` | `/api/v1/users/me/bookmarks` | Fetch personalized saved content |

---

## 🛡️ Security Validation Tests
This project maintains 100% reliability. Execute `npm run test` to bootup an ephemeral In-Memory MongoDB mapping the 25 core regression checks.

---

## 👨‍💻 Architecture By
**Mohammed Walid**  
Senior Backend Engineer  

LinkedIn: [https://www.linkedin.com/in/mohammed-waleed-2033872a7](https://www.linkedin.com/in/mohammed-waleed-2033872a7)  
GitHub: [https://github.com/MohammedWalid22](https://github.com/MohammedWalid22)  

## ⭐️ Support
If you learned from this backend or utilized it in your project, please star the repository!

## 📄 License
MIT License - Copyright © 2026 **Mohammed Walid**.
