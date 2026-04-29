# 🚀 Next-Gen Social Media Backend API
### Enterprise-Grade & Innovative Architecture by **Mohammed Walid**

![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)
![Express.js](https://img.shields.io/badge/Express.js-404D59?style=for-the-badge)
![MongoDB](https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)
![Google Cloud](https://img.shields.io/badge/Google_Cloud-4285F4?style=for-the-badge&logo=google-cloud&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2CA5E0?style=for-the-badge&logo=docker&logoColor=white)
![Jest](https://img.shields.io/badge/Jest-C21325?style=for-the-badge&logo=jest&logoColor=white)
![Swagger](https://img.shields.io/badge/Swagger-85EA2D?style=for-the-badge&logo=swagger&logoColor=black)

Welcome to a **tremendously robust, highly scalable, and exceptionally innovative** RESTful API. Built around the **MERN** stack architecture, this backend goes far beyond traditional CRUD operations. It acts as a full-fledged intelligent engine, integrating AI, Big Data concepts, and innovative social concepts to deliver an unparalleled digital experience.

---

## 🌟 Exclusive & Innovative Features

This API introduces unique product features rarely found in standard portfolios, designed to maximize user engagement and data safety:

### 🫧 1. Echo Chamber Detector (Algorithmic Insight)
- Uses **Shannon Entropy** to dynamically calculate how diverse a user's content feed and interactions are.
- Detects if users are stuck in an "Echo Chamber" and proactively recommends diverse topics and tags to balance their content diet.

### ⏳ 2. Time Capsule Posts
- Allows users to create a post and "seal" it. The content is securely hidden until an automated **Cron Job** fully unlocks and publishes it at an exact future date.
- Emits real-time triggers and notifications the moment a capsule is revealed.

### 📈 3. Viral Coefficient Tracker (K-Factor Insight)
- Automatically visualizes deeply nested **Share Trees** to calculate the real viral reach of any post.
- Assigns a K-Factor score to highlight content that achieves exponential growth, separating organic reach from isolated engagement.

### 🔗 4. Enterprise-Grade Webhook System
- Allows third-party applications or external microservices to subscribe to real-time events (`post.created`, `comment.added`, `user.followed`).
- Secured via **HMAC-SHA256 signatures** for payload integrity, including an intelligent auto-disable mechanism if a provided external server fails repeatedly.

### 🛡️ 5. GDPR-Compliant Privacy Audit Log
- A completely transparent security timeline! Enables users to track exactly who is interacting with their data, including profile views and invisible actions.
- Automatically handles **Privacy-By-Default** anonymization for non-followers and incorporates an automated 90-day TTL destruction policy.

---

## 🔥 Core Enterprise Functionalities

### 🧠 1. Trust, Safety & AI Voice Moderation
- **Transcribed Audio Comments:** Users can natively attach voice notes to posts. The system interacts with `@google-cloud/speech` to instantly transcribe audio to text.
- **AI Sentiment Analysis:** All textual and transcribed audio data is scanned via Google Cloud NLP to reject toxic content instantly and provide sentiment scoring.
- **Reporting Workflow:** Full administrative dashboard infrastructure with mod-states (`pending`, `reviewing`, `resolved`).

### 🎮 2. Gamification & Deep Interaction
- **Sticker Collections & Comments**: A scalable system for responding using moderated image/GIF stickers.
- **Facebook-Style Advanced Reactions**: Express emotion through `Like`, `Love`, `Laugh`, `Angry`, and `Sad` toggles.
- **Tiered Points System**: Automatically rewards points for interactions, assigning prestige badges and ranks.

### 👥 3. Collaboration & Community Graph
- **Collaborative Posts**: Multi-author support with a pending/accept workflow.
- **Infinite Groups**: Deeply structured community building with custom feeds and roles.
- **Advanced Bookmarks**: Create custom, organized collections of saved posts.

### ⚡ 4. Real-Time WebSockets & Global Caching
- **Bidirectional Sockets**: Pushes instant notifications for likes, follows, mentions, and updates directly to connected clients without long-polling.
- **Redis High-Performance Layer**: Leverages Redis for aggressively caching trending feeds with ultra-low latency, and applies robust Distributed Rate Limiting.

### 🔐 5. Ultimate Security Layer
- **Distributed Session Control**: Tracks unique device IDs, IPs, and User-Agents. Gives users the power to "Logout from all other devices".
- **Advanced Web Security Policies**: Integrated Helmet, HTTP Parameter Pollution protection (HPP), and Deep XSS Sanitization (`xss-clean`).

---

## 🛠️ Tech Stack Outline
- **Runtime Environment**: Node.js (Express.js)
- **Primary Database**: MongoDB (Mongoose ODMs, Geospatial Indexing, Aggregation Pipelines)
- **Memory/Cache Store**: Redis
- **Cloud & AI Services**: Google Cloud Platform (NLP & Speech), Cloudinary
- **Architecture**: Service-Oriented (Layered Controllers, Services, Middlewares)
- **Documentation**: Swagger UI & OpenAPI 3.0
- **Testing Assurance**: Jest + Supertest (Achieving comprehensive coverage across dozens of isolated suites)

---

## 📡 Explore The API (Swagger Documentation)

This backend provides beautifully structured, interactive OpenAPI documentation.

Explore the Live API Documentation online:
👉 **[Live SwaggerHub Documentation](https://app.swaggerhub.com/apis-docs/mohammedwalid/social-media-api/1.0.0)**

Or run it locally by starting the server and visiting:
👉 **`http://localhost:3000/api/v1/docs`**

*Features 90+ endpoints deeply documented with schemas, authentication mechanisms, and expected response payloads.*

---

## 🚀 Deployment & Installation

Spin up the entire Enterprise stack seamlessly inside isolated containers:

```bash
# 1. Clone the repository
git clone https://github.com/MohammedWalid22/Social-Media-API.git
cd Social-Media-API

# 2. Configure Environment variables (.env)
# Using provided .env.example

# 3. Mount Services using Docker Compose
docker-compose up --build
```
*The stack provisions Node.js, MongoDB, and Redis perfectly configured right out of the box.*

---

## 🧪 Quality & Reliability Guarantee
The application is governed by extremely strict Unit and Integration tests to ensure absolute stability in production environments.

*Run the test suite:*
```bash
npm run test
```
*Outputs a 100% success rate validating features ranging from Auth edge-cases to AI moderation failures.*

---

## 👨‍💻 Architecture & Engineering By
**Mohammed Walid**  
*Junior Backend Engineer*  

Building sophisticated, resilient, and forward-thinking backend systems.

🔗 **LinkedIn:** [https://www.linkedin.com/in/mohammed-waleed-2033872a7](https://www.linkedin.com/in/mohammed-waleed-2033872a7)  
🐙 **GitHub:** [https://github.com/MohammedWalid22](https://github.com/MohammedWalid22)  

---
*MIT License - Copyright © 2026 Mohammed Walid.*
