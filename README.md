# ASL Real-time Detection 🤟

Developed and maintained by **Amine NAHLI**.

A high-performance American Sign Language (ASL) recognition system featuring a **FastAPI backend** and a **React + Vite frontend**. This system leverages **MediaPipe Tasks API** for hand landmarker detection and a custom **PyTorch MLP** for real-time sign classification.

[![Python](https://img.shields.io/badge/Python-3.13+-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111+-009688.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18.0+-61DAFB.svg)](https://reactjs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 🚀 Key Features

- **Live Webcam Inference:** Real-time ASL prediction via optimized WebSocket streaming.
- **Modern MediaPipe Integration:** Uses the latest `HandLandmarker` Tasks API for superior tracking stability (Python 3.13 compatible).
- **Dual Mode Prediction:** Supports both live video streams and single image uploads.
- **Low Latency:** Inference path optimized for real-time interaction (Majority-vote smoothing & frame throttling).
- **Modern UI:** Responsive dashboard built with React and Vite.

---

## 🏗️ Architecture

- **Backend:** FastAPI with pre-loaded TorchScript model, MediaPipe vision tasks, and WebSocket frame throttling.
- **Frontend:** React application with real-time landmark overlay and smoothing logic.
- **Inference Pipeline:** Image decoding -> Hand Detection (MediaPipe) -> Landmark Normalization -> MLP Classification (PyTorch) -> Confidence Gating.

---

## ⚙️ Local Setup

### Prerequisites

- **Python 3.11 to 3.13**
- **Node.js 20+**
- A working webcam

### 1. Backend Setup

```bash
cd backend
python -m venv .venv
# Windows
.venv\Scripts\activate
# Install optimized dependencies
python -m pip install -r requirements.txt
# Launch on custom port 8091
python -m uvicorn app.main:app --host 0.0.0.0 --port 8091 --reload
```

_Backend API Docs: `http://localhost:8091/docs`_

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

_Frontend URL: `http://localhost:5173`_

---

## 🛠️ Configuration

The project is pre-configured to communicate on port **8091**. You can adjust settings in the `.env` files.

### Backend (`backend/.env`)

| Variable               | Value                       |
| :--------------------- | :-------------------------- |
| `APP_NAME`             | ASL Detection API           |
| `CORS_ORIGINS`         | `["http://localhost:5173"]` |
| `CONFIDENCE_THRESHOLD` | `0.55`                      |

### Frontend (`frontend/.env`)

| Variable             | Value                   |
| :------------------- | :---------------------- |
| `VITE_API_HTTP_BASE` | `http://localhost:8091` |
| `VITE_API_WS_BASE`   | `ws://localhost:8091`   |

---

## 🧠 Supported Signs

The model currently recognizes:

- **A-Z** (ASL Alphabet)
- **space**, **del**, **nothing**

---

## 🐳 Docker Deployment

The environment is containerized for easy deployment:

```bash
docker compose -f docker/docker-compose.yml up --build
```

---

## 👤 Author

**Amine NAHLI**

- GitHub: [Amine-NAHLI](https://github.com/Amine-NAHLI)
- Project Repository: [real-time-detection-hand](https://github.com/Amine-NAHLI/real-time-detection-hand)

---

_License: MIT. Credits to original researchers and data providers._
