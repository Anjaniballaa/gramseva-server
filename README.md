# 🌾 GramSeva
### *Bridging the gap between rural India and modern healthcare & agriculture.*

[![Client](https://img.shields.io/badge/Client-gramseva--client-green?style=for-the-badge)](https://github.com/anjaniballaa/gramseva-client)
[![Server](https://img.shields.io/badge/Server-gramseva--server-blue?style=for-the-badge)](https://github.com/anjaniballaa/gramseva-server)
[![ML Service](https://img.shields.io/badge/ML-gramseva--ml--service-orange?style=for-the-badge)](https://github.com/anjaniballaa/gramseva-ml-service)

---

> *For the farmer who needs to know if his crops are sick,*
> *the mother who needs a doctor at 2AM in a village with no clinic,*
> *and the Gram Sevak who carries the weight of an entire community.*

---

## ✨ What is GramSeva?

GramSeva is a **multilingual, AI-powered mobile application** built for rural India — connecting farmers, villagers, health workers, and doctors on a single platform.

Built with ❤️ for **Bharat**.

---

## 📲 Download the App

[![Download APK](https://img.shields.io/badge/Download-APK-brightgreen?style=for-the-badge&logo=android)](https://expo.dev/accounts/anjani_balla/projects/gramseva/builds/a4915ed9-c456-493a-abb1-34bce6eafb10)

> Scan the QR code below to download directly on your Android device:

<p align="center">
  <img src="https://github.com/anjaniballaa/gramseva/blob/main/qr.jpeg" width="200" alt="GramSeva QR Code"/>
</p>

---

## 👥 4 Roles. One Platform.

```
🧑‍🌾  Farmer      →  Scan crops, get AI treatment, crop advisory
🏘️  Villager    →  Check symptoms, consult doctor, health cards
🩺  Doctor      →  Video consult, write & send prescriptions
👨‍💼  Gram Sevak  →  Monitor community, view reports, reply to all
```

---

## 🚀 Features

### 🧑‍🌾 Farmer
- **AI Crop Disease Detection** — Point camera at crop, get instant diagnosis
- **Treatment Plans** — Chemical, organic & medical treatment recommendations
- **Prevention Tips** — Stop the disease before it spreads
- **Crop Advisory** — Personalized crop-specific guidance
- **Weather Advisory** — 7-day forecast tailored to your crops

### 🏘️ Villager
- **Symptom Checker** — AI-powered health analysis
- **Connect to Doctor** — Book and join video consultations
- **Digital Prescriptions** — Receive prescriptions directly in feed
- **Digital Health Cards** — Family health records, always accessible
- **Community Feed** — Stay updated with posts from Gram Sevak & doctors

### 🩺 Doctor
- **Video Consultation** — Connect with patients via Jitsi Meet
- **Digital Prescriptions** — Write and send prescriptions instantly
- **Patient Feed** — Posts visible to villagers in real time
- **Real-time Chat** — Message patients directly

### 👨‍💼 Gram Sevak
- **Community Dashboard** — View and reply to farmer & villager posts
- **Health Cards Access** — View health records of community members
- **Village Reports** — Track community health trends
- **Broadcast Alerts** — Post advisories visible to everyone

---

## 🌟 Platform Features

- 📍 **Live Location Detection** — Auto village & nearby center detection
- 💬 **Real-time Chat** — Socket.io powered instant messaging
- 🌐 **Multilingual** — English, हिंदी, తెలుగు

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Mobile App | React Native (Expo) |
| Backend | Node.js, Express, MongoDB |
| ML Service | Python, Flask, Google Gemini AI |
| Real-time | Socket.io |
| Video | Jitsi Meet |
| Location | Expo Location |
| Hosting | Render.com |

---

## 📦 Repositories

| Module | Repo |
|--------|------|
| 📱 Client | [gramseva-client](https://github.com/anjaniballaa/gramseva-client) |
| ⚙️ Server | [gramseva-server](https://github.com/anjaniballaa/gramseva-server) |
| 🤖 ML Service | [gramseva-ml-service](https://github.com/anjaniballaa/gramseva-ml-service) |

---

## ⚡ Getting Started

### 1. Setup Server
```bash
cd server
npm install
cp .env.example .env   # Add MONGODB_URI, JWT_SECRET, GEMINI_API_KEY
npm start
```

### 2. Setup ML Service
```bash
cd ml-service
pip install -r requirements.txt
python app.py
```

### 3. Setup Client
```bash
cd client
npm install
npx expo start         # Scan QR with Expo Go app
```

---

## 🔐 Environment Variables

```env
MONGODB_URI=your_mongodb_uri
JWT_SECRET=your_secret_key
GEMINI_API_KEY=your_gemini_key
PORT=5000
```

---

## 🌍 Deployment

| Service | Platform |
|---------|----------|
| Backend Server | Render.com |
| ML Service | Render.com |
| Database | MongoDB Atlas |

---

<div align="center">

### 🌾 *Seva for every Gram.*
**Made with ❤️ for Rural India**

*"Technology should reach the last mile — not stop at the city limits."*

</div>
