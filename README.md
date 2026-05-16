# ASL Real-time Detection 🤟

Developed and maintained by **Amine NAHLI**.

[![Python](https://img.shields.io/badge/Python-3.11%20|%203.13-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111+-009688.svg)](https://fastapi.tiangolo.com/)
[![Expo SDK](https://img.shields.io/badge/Expo_SDK-55.0-black.svg)](https://expo.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 📝 Description
A high-performance American Sign Language (ASL) recognition system featuring a **FastAPI backend**, a **React + Vite frontend**, and a **cross-platform mobile app (Expo)**. This system leverages **MediaPipe Hands** for hand landmarker detection and a custom **PyTorch MLP** for real-time sign classification.

![Screenshot Placeholder](https://via.placeholder.com/800x400?text=ASL+Detection+Interface+Preview)

---

## 🛠️ Prerequisites
Ensure you have the following installed on your machine:
- **Python 3.11 to 3.13**
- **Node.js 20+** (LTS recommended)
- **npm** or **yarn**
- **Expo CLI** (`npm install -g expo-cli`)
- **Git**
- A working webcam (for Web) or a physical smartphone (for Mobile)

---

## 🚀 Installation — Step by Step

### 1. Clone the Project
```bash
git clone https://github.com/Amine-NAHLI/real-time-detection-hand.git
cd Real-time-ASL-Detection-from-Video-Image
```

### 2. Backend Setup
The backend serves as the inference engine.
```bash
cd backend
python -m venv .venv

# Activate environment
# Windows:
.venv\Scripts\activate
# Mac/Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Launch the backend
uvicorn app.main:app --host 0.0.0.0 --port 8091 --reload
```
> [!IMPORTANT]
> Ensure the model weights (e.g., `hand_landmarker.task`) are present in `backend/weights/`.

### 3. Mobile App (Expo)
The mobile app can run in the browser, on an emulator, or on a physical device.
```bash
cd mobile
npm install --legacy-peer-deps
npx expo start
```
#### 🌐 Connecting to the Backend
To connect your phone to the backend, they **MUST** be on the same WiFi network.
1. Find your computer's local IP address:
   - **Windows**: Run `ipconfig` (look for IPv4 Address).
   - **Mac/Linux**: Run `ifconfig` or `ip addr`.
2. Open the Mobile App.
3. Go to **Settings** (⚙️ icon).
4. Update the **Server IP** with your computer's IP (e.g., `192.168.1.15`).
5. Set the **Port** to `8091`.

| Environment | Backend URL |
| :--- | :--- |
| **Web Browser** | `http://127.0.0.1:8091` |
| **Android Emulator** | `http://10.0.2.2:8091` |
| **Physical Device** | `http://<YOUR_LOCAL_IP>:8091` |

### 4. Frontend Web (React + Vite)
If you prefer the dedicated web dashboard:
```bash
cd frontend
npm install
npm run dev
```
Accessible at: `http://localhost:5173`

---

## ⚙️ Configuration

### Environment Variables
Check the `.env.example` files in each directory:
- `backend/.env.example`
- `frontend/.env.example`
- `mobile/config.js` (for mobile-specific constants)

### Port Settings
- **Backend**: 8091 (Default)
- **Frontend**: 5173
- **Mobile (Expo)**: 8081

---

## 🎮 Usage

### 🎥 Live Recognition
- **Web**: Open the dashboard and allow camera access. Landmarks will appear over your hand.
- **Mobile**: Tap "Grant Permission" and point the front camera at your hand.

### ⌨️ Text Construction (Mobile Feature)
1. **Detection**: Hold a sign steadily for ~4 frames.
2. **Accumulation**: The letter will be added to the top display.
3. **Space/Delete**: Use specific signs (if trained) or the UI buttons to manage text.
4. **Clear**: Use the 🗑️ icon to reset the detected text.

---

## 🏗️ Project Architecture
```text
.
├── backend/        # FastAPI Server, PyTorch Logic, MediaPipe Services
├── frontend/       # React + Vite Dashboard (Tailwind/CSS)
├── mobile/         # Expo App (React Native)
├── docker/         # Dockerfiles and Compose for deployment
└── weights/        # AI Model files (.task, .pth)
```

---

## 🧪 Technologies
- **Backend**: FastAPI, MediaPipe Hands, PyTorch 2.4+, OpenCV.
- **Frontend**: React 18, Vite, Reconnecting WebSocket.
- **Mobile**: Expo SDK 55, React Native, Lucide Icons.
- **Infrastructure**: Docker, Docker Compose.

---

## 🔍 Troubleshooting

- **Connection Refused**: Ensure the backend is running on `0.0.0.0:8091`.
- **Camera Not Working**: Check browser permissions or Expo camera permissions in settings.
- **WebSocket Disconnects**: Ensure your phone and PC are on the same WiFi network and the IP address in settings is correct.
- **Missing Weights**: If the server fails to start, verify that `backend/weights/hand_landmarker.task` exists.

---

## 🤝 Contributing
1. Fork the Project.
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`).
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the Branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

---

_License: MIT. Developed with ❤️ by Amine NAHLI._
