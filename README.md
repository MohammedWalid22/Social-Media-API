# 🚀 Advanced Social Media Backend API
### Enterprise-Level Architecture by **Mohammed Walid**

![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)
![Express.js](https://img.shields.io/badge/Express.js-404D59?style=for-the-badge)
![MongoDB](https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)
![Google Cloud](https://img.shields.io/badge/Google_Cloud-4285F4?style=for-the-badge&logo=google-cloud&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2CA5E0?style=for-the-badge&logo=docker&logoColor=white)
![Jest](https://img.shields.io/badge/Jest-C21325?style=for-the-badge&logo=jest&logoColor=white)

A tremendously robust, secure, and feature-rich RESTful API built with the **MERN** stack architecture. This project isn't just a basic social media tool; it's a production-ready engine featuring **AI Moderation**, **Real-time Gamification**, **Advanced Device Security**, and **Audio-to-Text Intelligence**.

---

## 🔥 Enterprise Features Implemented

### 🛡️ 1. Trust, Safety & AI Moderation
- **Advanced Report & Ticket System**: A complete infrastructure for reporting Users, Posts, and Comments. Includes a moderation dashboard workflow with statuses: `pending`, `reviewing`, `resolved`, `dismissed`.
- **AI Sentiment Analysis**: Every post is automatically analyzed using `Google Cloud Natural Language API`. Posts are assigned a `sentimentScore`, enabling "Positivity Mode" for a cleaner user experience.
- **Muted Content Engine**: Users can personally mute specific words or sensitive phrases. The feed algorithm dynamically filters content using high-performance regex scanning at the database level.

### 🎙️ 2. Intelligent Audio & Voice Comments (Next-Gen)
- **Voice-to-Text Transcription**: Users can post audio comments. The system utilizes `@google-cloud/speech` to automatically transcribe audio into text in real-time.
- **Searchable Audio**: Transcripts are natively stored and indexed in MongoDB, making voice content purely searchable and accessible.
- **Audio Moderation**: Transcripts are scanned for toxicity just like standard text, ensuring voice interactions remain safe.

### 🍱 3. Advanced Social Graph & Collaboration
- **Groups & Communities**: Infinite group creation with `public` and `private` visibility, member management, and dedicated group feeds.
- **Collaborative Publishing**: Support for multiple authors on a single post features an "Invitation & Acceptance" logic to ensure all co-authors consent before going live.
- **Bookmarks (Saved Posts)**: Personal collections for users to save and categorize posts for future reference.

### 🎮 4. Gamification, Interactions & Media
- **Sticker Comments**: Users can seamlessly respond to posts with predefined image/gif Stickers managed by a scalable Sticker Collection architecture.
- **Nested Threaded Comments**: Support for multi-level replies (threads) to foster deep community discussions.
- **Facebook-Style Multi-Reactions**: Advanced reaction system for both Posts and Comments supporting `Like`, `Love`, `Laugh`, `Angry`, and `Sad`.
- **Dynamic Gamification Engine**: Awards points for high-value actions (posting, commenting) and dynamically assigns milestone badges (`Active Member`, `Top Commenter`).

### ⚡ 5. Real-Time WebSockets & Notifications
- **Socket.io Integration**: Live bidirectional communication infrastructure enabling immediate notification pushes.
- **Instant Alerts**: Users receive real-time, unrefreshed alerts when someone interacts with their posts, mentions them, or sends a group invitation.

### 🔒 6. Security, Sessions & Performance
- **Device & Session Management**: Sophisticated session tracking that captures device IDs, IP addresses, and `User-Agent` fingerprints. Includes the "Logout from all devices" feature.
- **Redis-Powered Caching & Rate Limiting**: Global caching for feed generation and strict rate limiting (DDoS protection) using Redis.
- **Clean Architecture**: Decoupled service layer architecture using controllers, models, and middleware for 100% maintainability.

---

## 🛠️ Tech Stack Outline
- **Runtime**: Node.js (with Express.js)
- **Database**: MongoDB (Mongoose)
- **Memory Store**: Redis (Caching, Rate Limiting)
- **AI Intelligence**: Google Cloud Natural Language & Speech-to-Text
- **Security**: JWT (Secure Sessions), Helmet.js, HPP, XSS-Clean
- **Documentation**: Swagger UI / OpenDocs
- **Testing**: Jest, Supertest (25+ Integration Tests)

---

## 📡 Key Endpoints & Interactive Docs

Access the full Interactive API playground:
👉 `http://localhost:3000/api/v1/docs`

| Category | Key Endpoint | Description |
| :--- | :--- | :--- |
| **Moderation** | `POST /api/v1/reports` | Report abusive content |
| **Audio** | `POST /api/v1/comments` | Post audio/text with AI transcription |
| **Groups** | `POST /api/v1/groups/:id/join` | Join/Manage communities |
| **Security** | `GET /api/v1/auth/sessions` | View and manage active device sessions |
| **Gamification** | `GET /api/v1/users/me` | Check your points and badges |

---

## 🚀 Deployment (1-Click Docker)

Spin up the entire Enterprise stack (API, MongoDB, Redis) instantly:

```bash
git clone https://github.com/MohammedWalid22/Social-Media-API.git
cd Social-Media-API
docker-compose up --build
```

---

## 🧪 Quality & Reliability
The system is built with a **100% Success Rate** across all regression tests.
`npx jest tests/report.test.js tests/group.test.js tests/session.test.js tests/bookmark.test.js tests/reactions.test.js --runInBand`

---

## 👨‍💻 Architecture By
**Mohammed Walid**  
Senior Backend Engineer  

LinkedIn: [https://www.linkedin.com/in/mohammed-waleed-2033872a7](https://www.linkedin.com/in/mohammed-waleed-2033872a7)  
GitHub: [https://github.com/MohammedWalid22](https://github.com/MohammedWalid22)  

## 📄 License
MIT License - Copyright © 2026 **Mohammed Walid**.
