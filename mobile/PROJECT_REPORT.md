# RAPPORT COMPLET DU PROJET — Real-time ASL Detection

---

## 1. VUE D'ENSEMBLE

**Nom du projet :** Real-time ASL Detection from Video/Image

**Objectif principal :** Détecter en temps réel les signes du langage des signes américain (ASL) via une caméra ou une image, reconnaître les lettres signées, les accumuler en mots, et offrir des fonctionnalités supplémentaires (traduction en arabe, saisie vocale).

**Technologies utilisées :**

| Couche | Technologie | Version |
|---|---|---|
| Backend API | FastAPI | ≥0.111.0 |
| Backend serveur | Uvicorn (ASGI) | ≥0.30.1 |
| ML inference | PyTorch (TorchScript) | ≥2.4.0 |
| Détection de mains | MediaPipe Tasks (HandLandmarker) | ≥0.10.14 |
| Traitement image | OpenCV, Pillow | ≥4.10 / ≥10.4 |
| Validation données | Pydantic v2 + pydantic-settings | ≥2.3.4 |
| Framework mobile | React Native + Expo | RN 0.83.6 / Expo 55 |
| Caméra mobile | expo-camera | ~55.0.18 |
| Galerie mobile | expo-image-picker | ~55.0.20 |
| Persistance mobile | @react-native-async-storage | 2.2.0 |
| WebSocket client | Native browser/RN WebSocket API | — |
| Traduction | MyMemory REST API | gratuit, sans clé |
| Speech-to-Text | Web Speech API (navigateur) | standard W3C |
| UI icons | lucide-react-native | ^0.400.0 |
| Animation | React Native Animated | (inclus RN) |

**Architecture globale :**

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENT MOBILE                         │
│  Expo (Web / iOS / Android)                             │
│                                                          │
│  ┌─────────────┐  WebSocket ws://IP:8091/api/v1/ws/predict │
│  │ CameraFrame │──────────────────────────────────────────►│
│  │ (base64)    │◄──────────────────────────────────────────│
│  └─────────────┘  { pred, confidence, hand_detected,    │
│                     landmarks, hands }                   │
│                                                          │
│  ┌─────────────┐  POST /api/v1/predict/image             │
│  │ ImagePicker │──────────────────────────────────────────►│
│  │ (multipart) │◄──────────────────────────────────────────│
│  └─────────────┘  { pred, confidence, hand_detected }    │
│                                                          │
│  MyMemory API   ──────────────────────────────────────── ►│ (externe)
│  SpeechRecog.   (navigateur uniquement, API W3C)         │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                    BACKEND FastAPI                        │
│  PORT 8091                                               │
│                                                          │
│  MediaPipe HandLandmarker → Normalize → Build Features   │
│  → TorchScript Classifier → Smoothing (MajorityVote)    │
│  → JSON Response                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 2. BACKEND — ANALYSE COMPLÈTE

### 2.1 Structure des fichiers

```
backend/
├── app/
│   ├── main.py                        Point d'entrée FastAPI, lifespan, CORS, montage routes
│   ├── state.py                       Dataclass AppState (settings, predictor, hands)
│   ├── api/
│   │   └── v1/
│   │       ├── router.py              Agrège les 3 sous-routeurs (health, predict_image, ws)
│   │       └── endpoints/
│   │           ├── health.py          GET /health → HealthResponse
│   │           ├── predict_image.py   POST /predict/image → PredictResponse
│   │           └── ws_predict.py      WS /ws/predict → flux de prédictions
│   ├── core/
│   │   ├── config.py                  Settings Pydantic (.env + defaults)
│   │   ├── dependency.py              get_app_state(), get_settings() pour FastAPI DI
│   │   ├── exceptions.py              AppError, InvalidImageError, InferenceError + handlers
│   │   └── logging.py                 JsonFormatter + configure_logging()
│   ├── schemas/
│   │   ├── health.py                  HealthResponse
│   │   └── predict.py                 WSControl, LandmarkPoint, HandResult,
│   │                                  PredictResponse, WSFrameIn, WSFrameOut
│   ├── services/
│   │   ├── model_loader.py            Charge asl_classifier.pt + labels.json + calibration.json
│   │   ├── mediapipe_hands.py         HandsService (MediaPipe HandLandmarker, thread-safe)
│   │   ├── predictor.py               Predictor : pipeline complet image RGB → (pred, conf, …)
│   │   ├── preprocessing.py           normalize_landmarks(), build_features() (angles, bones)
│   │   └── smoothing.py               MajorityVoteSmoother (deque + Counter)
│   └── utils/
│       ├── image_io.py                bytes_to_rgb, base64_to_rgb, resize_rgb, rgb_to_jpeg_bytes
│       └── timing.py                  FrameGate (rate-limiter par FPS cible)
├── weights/
│   ├── asl_classifier.pt              Modèle TorchScript
│   ├── labels.json                    Mapping index → label (lettres ASL)
│   ├── calibration.json               Seuil de confiance calibré
│   ├── preprocess.json                Flags features (include_z, include_bones, etc.)
│   └── hand_landmarker.task           Modèle MediaPipe binaire
├── tests/
│   ├── test_health.py                 Test GET /health
│   └── test_predict_image.py          Test POST /predict/image avec image vierge
├── requirements.txt                   Dépendances Python
└── .env.example                       Template de configuration
```

### 2.2 API Endpoints

#### GET `/api/v1/health`
- **Paramètres :** aucun
- **Réponse 200 :**
```json
{
  "ok": true,
  "device": "cpu",
  "model_loaded": true
}
```

#### POST `/api/v1/predict/image`
- **Content-Type :** `multipart/form-data`
- **Champ :** `image` (fichier binaire JPEG/PNG)
- **Réponse 200 (1 main) :**
```json
{
  "pred": "A",
  "confidence": 0.923,
  "hand_detected": true,
  "hands": null
}
```
- **Réponse 200 (2 mains) :**
```json
{
  "pred": "A",
  "confidence": 0.923,
  "hand_detected": true,
  "hands": [
    { "pred": "A", "confidence": 0.923, "hand_detected": true, "landmarks": null },
    { "pred": "B", "confidence": 0.871, "hand_detected": true, "landmarks": null }
  ]
}
```
- **Réponse 400 :** `{ "error": { "code": "INVALID_IMAGE", "message": "..." } }`

#### WebSocket `/api/v1/ws/predict`
- **Messages client → serveur :**
```json
{ "frame": "data:image/jpeg;base64,..." }
```
- **Message de contrôle :**
```json
{ "control": { "send_landmarks": true, "smoothing_window": 10, "confidence_threshold": 0.7 } }
```
- **Messages serveur → client :**
```json
{
  "pred": "A",
  "confidence": 0.91,
  "hand_detected": true,
  "landmarks": [{"x": 0.52, "y": 0.34, "z": -0.01}, ...],
  "hands": null
}
```
- **Message d'erreur :**
```json
{ "detail": "Invalid JSON payload" }
```

### 2.3 Pipeline de détection

```
Image RGB (numpy uint8)
  │
  ▼
resize_rgb(max_size=480px)        ← redimensionne sans déformer si > 480px
  │
  ▼
MediaPipe HandLandmarker.detect() ← détecte jusqu'à 2 mains, retourne 21 landmarks 3D par main
  │
  ├─ Aucune main → ("nothing", 0.0, False, None, [])
  │
  └─ Mains détectées → pour chaque main :
        │
        ▼
      normalize_landmarks(pts)    ← centre sur poignet (index 0), scale par distance max XY
        │
        ▼
      build_features(pts_norm)    ← concatène :
        │                            [pts_norm.reshape(-1)]     = 21×3 = 63 floats (avec Z)
        │                            [bone_vectors]             = 20×3 = 60 floats
        │                            [angle_values]             = 13 floats
        │                            [hand_present]             = 1 float
        │                            TOTAL = 137 floats
        ▼
      torch.from_numpy(feat)       ← tensor (1, 137)
        │
        ▼
      model(xt)                    ← TorchScript, logits (1, N_classes)
        │
        ▼
      softmax → argmax             ← label + confidence
        │
        ▼
      Seuil confidence_threshold   ← si conf < seuil → "nothing"
        │
        ▼
  MajorityVoteSmoother (WebSocket uniquement)
        │
        ▼
  Réponse JSON
```

### 2.4 Modèle ML

| Attribut | Valeur |
|---|---|
| Fichier | `weights/asl_classifier.pt` |
| Format | TorchScript (torch.jit.load) |
| Device | CUDA si disponible, sinon CPU |
| Entrée | Vecteur float32 de dimension 137 |
| Sortie | Logits sur N classes (lettres ASL) |
| Labels | `weights/labels.json` — tableau de strings |
| Seuil calibré | `weights/calibration.json` → `suggested_conf_threshold` |
| Seuil défaut | 0.55 (config.py) |
| Warmup | Dummy frame 480×480 au démarrage |

### 2.5 Configuration (`config.py`)

| Paramètre | Valeur par défaut | Description |
|---|---|---|
| `app_name` | `"ASL Detection API"` | Titre FastAPI |
| `debug` | `False` | Mode debug |
| `api_v1_prefix` | `"/api/v1"` | Préfixe routes |
| `log_level` | `"INFO"` | Niveau logs |
| `log_json` | `True` | Format JSON logs |
| `expose_error_details` | `False` | Détails d'erreur en réponse |
| `cors_origins` | `["http://localhost:5173", "http://127.0.0.1:5173"]` | CORS autorisés |
| `weights_dir` | `backend/weights/` | Répertoire modèles |
| `confidence_threshold` | `0.55` | Seuil confiance défaut |
| `max_num_hands` | `2` | Mains max détectées |
| `min_detection_confidence` | `0.3` | Seuil détection MediaPipe |
| `min_tracking_confidence` | `0.5` | Seuil suivi MediaPipe |
| `ws_smoothing_window` | `10` | Fenêtre vote majoritaire |
| `ws_target_fps` | `30` | FPS cible WebSocket |
| `max_frame_size` | `480` | Taille max image (px) |

### 2.6 Dépendances (`requirements.txt`)

```
fastapi>=0.111.0
uvicorn[standard]>=0.30.1
pydantic-settings>=2.3.4
python-multipart>=0.0.9
numpy>=2.1.0
opencv-contrib-python-headless>=4.10.0.84
Pillow>=10.4.0
torch>=2.4.0
mediapipe>=0.10.14
pytest>=8.2.2
httpx>=0.27.0
```

---

## 3. MOBILE — ANALYSE COMPLÈTE

### 3.1 Structure des fichiers

```
mobile/
├── App.js                         Composant racine (2 chemins : Web / Native)
├── config.js                      CONFIG : SERVER_IP, PORT, API_PREFIX
├── app.json                       Configuration Expo (permissions iOS/Android, web bundler)
├── babel.config.js                Preset babel-preset-expo
├── package.json                   Dépendances npm
├── components/
│   ├── CameraBackground.native.js Référence placeholder (import auto par Expo)
│   ├── CameraBackground.web.js    Caméra web via getUserMedia, expose takePictureAsync
│   ├── PredictionCard.js          Carte LIVE RECOGNITION (lettre, confiance, statut main)
│   ├── SettingsModal.js           Modal réglages IP/Port serveur (AsyncStorage)
│   ├── TranslationModal.js        Modal traduction FR→AR (RTL, ActivityIndicator)
│   └── WordDisplay.js             Carte DETECTED TEXT avec bouton ترجمة et trash
├── hooks/
│   └── useASLWebSocket.js         Hook WebSocket (connexion, reconnexion exponentielle, sendFrame)
└── services/
    └── translationService.js      translateToArabic() via MyMemory API
```

### 3.2 Composants UI

#### `App.js` — Composant principal
Gère tout le state applicatif et offre deux rendus selon la plateforme :
- **Web** : `<WebLayout>` — rendu HTML/CSS pur avec classes CSS injectées dynamiquement
- **Native** : `<CameraBackground>` + `<SafeAreaView>` overlay avec tous les widgets RN

**State principal :**
| State | Type | Rôle |
|---|---|---|
| `config` | object | IP/port serveur |
| `isSettingsVisible` | bool | Visibilité modal paramètres |
| `isAutoMode` | bool | Mode Manuel vs Auto |
| `accumulatedText` | string | Lettres accumulées (caméra live) |
| `finalText` | string | Texte validé (résultats upload) |
| `isUploading` | bool | Upload en cours |
| `uploadResult` | object\|null | Résultat JSON upload |
| `uploadPreviewUri` | string\|null | URI image choisie |
| `showUploadModal` | bool | Visibilité modal upload |
| `translationVisible` | bool | Visibilité TranslationModal |
| `translationOriginal` | string | Texte source à traduire |
| `translationResult` | string | Traduction arabe reçue |
| `isTranslating` | bool | Requête traduction en cours |
| `translationError` | bool | Erreur traduction |
| `manualInput` | string | Saisie manuelle dans TextInput |
| `isListening` | bool | STT en cours (animation) |

#### `WordDisplay.js`
**Props :** `text: string`, `onClear: fn`, `onTranslate: fn`
**Rendu :** Carte sombre avec titre "DETECTED TEXT", ScrollView horizontal du texte accumulé, curseur clignotant, bouton ترجمة (violet) + bouton trash (rouge).

#### `PredictionCard.js`
**Props :** `prediction: string`, `confidence: number`, `handDetected: boolean`
**Rendu :** Carte avec grande lettre prédite (84px), barre de confiance (width en %), point vert/rouge statut main.

#### `SettingsModal.js`
**Props :** `visible`, `onClose`, `config`, `onSave`
**State interne :** `ip`, `port`
**Rendu :** Modal `expo-blur`, deux `TextInput` pour IP/port, bouton "Apply Changes" qui appelle `onSave`.

#### `TranslationModal.js`
**Props :** `visible`, `onClose`, `originalText`, `translatedText`, `isLoading`, `error`
**Rendu :** Bottom sheet (animationType="slide"), texte original en haut, texte arabe RTL en bas (`textAlign: 'right'`, `writingDirection: 'rtl'`), `ActivityIndicator` pendant le fetch, message "Erreur de traduction" en cas d'échec.

#### `CameraBackground.web.js`
**Props :** `style`, `onCameraReady`, `children` (via forwardRef)
**Expose :** `takePictureAsync({ quality })` → `{ base64, uri }`
**Rendu :** `<video>` HTML via `getUserMedia`, overlay `<View>` pour children. Nettoyage stream sur démontage.

### 3.3 Hooks personnalisés

#### `useASLWebSocket(url)`
**Paramètre :** `url` — URL WebSocket complète (`ws://IP:PORT/api/v1/ws/predict`)

**Valeurs retournées :**
| Valeur | Type | Description |
|---|---|---|
| `prediction` | string | Dernière prédiction (`"A"`…`"Z"`, `"space"`, `"del"`, `"nothing"`) |
| `confidence` | number | Confiance 0–1 |
| `handDetected` | boolean | Main détectée dans le frame |
| `landmarks` | array\|null | 21 points 3D de la main (si `send_landmarks: true`) |
| `isConnected` | boolean | WebSocket en état OPEN |
| `status` | WS_STATUS enum | CONNECTING / CONNECTED / DISCONNECTED / ERROR |
| `wsError` | string\|null | Message d'erreur courant |
| `sendFrame` | fn(base64) | Envoie un frame au serveur |

**Comportement :**
- Reconnexion automatique avec backoff exponentiel (min 1s → max 30s, facteur 1.4×)
- Au premier `onopen` : envoie `{ control: { send_landmarks: true } }` pour activer les landmarks
- `aliveRef` guard : empêche les setState après démontage
- Nettoyage complet sur unmount : `ws.close(1000, 'unmount')` + clearTimeout

### 3.4 Services

#### `translationService.js` — `translateToArabic(text)`
- **API :** `GET https://api.mymemory.translated.net/get?q=<text>&langpair=en|ar`
- **Retourne :** `string` (texte arabe traduit)
- **Erreurs :** `throw new Error('Invalid response')` si `responseData.translatedText` absent
- **Limites MyMemory :** ~5000 caractères/jour sans clé, 50 000 avec email

### 3.5 Flux de données principal

```
[Caméra / getUserMedia]
        │ 250ms (CAPTURE_INTERVAL_MS)
        ▼
takePictureAsync({ base64: true, quality: 0.2 })
        │
        ▼
sendFrame("data:image/jpeg;base64,...")
        │ WebSocket
        ▼
Backend: MediaPipe → Model → MajorityVoteSmoother
        │
        ▼
{ pred, confidence, hand_detected, landmarks }
        │
        ▼
useASLWebSocket → { prediction, confidence, handDetected }
        │
        ├── [Mode Manuel] stabilityCounter++ (chaque render si même pred)
        │       si counter ≥ STABILITY_REQUIRED (4) ET pred ≠ lastCommittedSign
        │       → commitSign(prediction) → setAccumulatedText(...)
        │
        └── [Mode Auto] interval 100ms
                si conf ≥ 0.80 ET hand ET holdTime ≥ 1000ms
                → commitSign(prediction) → setAccumulatedText(...)

[commitSign]
  "space"       → accumulatedText + " "
  "del"         → accumulatedText.slice(0, -1)
  lettre unique → accumulatedText + lettre.toUpperCase()
```

### 3.6 Fonctionnalités

| Fonctionnalité | Description |
|---|---|
| **Détection live (caméra)** | Frame capturé toutes les 250ms, envoyé au backend via WebSocket |
| **Accumulation de lettres** | Les lettres reconnues s'accumulent dans `accumulatedText` |
| **Mode Manuel** | Accumulation par compteur de stabilité (4 frames identiques) |
| **Mode Auto** | Accumulation par maintien temporel (1000ms) + anti-doublon |
| **Upload image** | Galerie → `multipart/form-data` → backend → affichage résultat |
| **Multi-main** | Affichage des 2 mains avec lettres et confiances séparées |
| **Traduction en arabe** | Texte accumulé ou saisie manuelle → MyMemory → TranslationModal RTL |
| **Saisie manuelle** | TextInput + bouton ترجمة au bas de l'écran |
| **Speech-to-Text** | Web Speech API (navigateur) → remplit le TextInput |
| **Reconnexion WS** | Backoff exponentiel, badge de statut coloré |
| **Paramètres serveur** | IP + Port configurables et persistés (AsyncStorage) |
| **Rendu web adaptatif** | Layout HTML/CSS séparé pour Expo Web (2 colonnes ≥768px) |
| **Landmarks** | Overlay canvas dessinant le squelette MediaPipe sur le flux vidéo (web) |

### 3.7 Dépendances (`package.json`)

| Package | Version | Rôle |
|---|---|---|
| `expo` | ~55.0.24 | Framework build + dev server |
| `react` | 19.2.0 | UI library |
| `react-native` | 0.83.6 | Composants natifs |
| `react-dom` | 19.2.0 | Rendu web |
| `react-native-web` | ^0.21.0 | Bridge RN → DOM |
| `expo-camera` | ~55.0.18 | Accès caméra native |
| `expo-image-picker` | ~55.0.20 | Galerie photo native |
| `expo-blur` | ~55.0.14 | BlurView (SettingsModal) |
| `expo-status-bar` | ~55.0.6 | StatusBar Expo |
| `@react-native-async-storage/async-storage` | 2.2.0 | Persistance IP/Port |
| `lucide-react-native` | ^0.400.0 | Icônes SVG |
| `react-native-gesture-handler` | ~2.30.0 | Gestes tactiles |
| `react-native-reanimated` | 4.2.1 | Animations avancées |
| `react-native-safe-area-context` | ~5.6.2 | Safe area (notch) |
| `react-native-screens` | ~4.23.0 | Navigation optimisée |
| `react-native-svg` | 15.15.3 | SVG natif |
| `react-native-worklets` | ^0.8.3 | Worklets Reanimated |
| `@expo/metro-runtime` | ~55.0.11 | Runtime Metro bundler |

---

## 4. COMMUNICATION BACKEND ↔ MOBILE

### 4.1 WebSocket `/api/v1/ws/predict`

**Client → Serveur (frame vidéo) :**
```json
{
  "frame": "data:image/jpeg;base64,/9j/4AAQSkZJRgAB..."
}
```

**Client → Serveur (contrôle initial) :**
```json
{
  "control": {
    "send_landmarks": true,
    "smoothing_window": 10,
    "confidence_threshold": 0.75
  }
}
```

**Serveur → Client (prédiction normale) :**
```json
{
  "pred": "A",
  "confidence": 0.923,
  "hand_detected": true,
  "landmarks": [
    {"x": 0.523, "y": 0.341, "z": -0.012},
    ...
  ],
  "hands": null
}
```

**Serveur → Client (prédiction 2 mains) :**
```json
{
  "pred": "A",
  "confidence": 0.923,
  "hand_detected": true,
  "landmarks": [...],
  "hands": [
    {"pred": "A", "confidence": 0.923, "hand_detected": true},
    {"pred": "B", "confidence": 0.871, "hand_detected": true}
  ]
}
```

**Serveur → Client (erreur) :**
```json
{ "detail": "Invalid JSON payload" }
```

### 4.2 REST POST `/api/v1/predict/image`

**Requête :**
```
POST /api/v1/predict/image
Content-Type: multipart/form-data; boundary=----FormBoundary

----FormBoundary
Content-Disposition: form-data; name="image"; filename="photo.jpg"
Content-Type: image/jpeg

<binary JPEG data>
----FormBoundary--
```

**Réponse 200 :**
```json
{
  "pred": "C",
  "confidence": 0.871,
  "hand_detected": true,
  "hands": null
}
```

**Réponse 400 (image invalide) :**
```json
{
  "error": {
    "code": "INVALID_IMAGE",
    "message": "Image could not be decoded or validated.",
    "request_id": null
  }
}
```

### 4.3 REST GET `/api/v1/health`

**Réponse 200 :**
```json
{
  "ok": true,
  "device": "cpu",
  "model_loaded": true
}
```

---

## 5. FONCTIONNALITÉS DÉTAILLÉES

### 5.1 Détection en temps réel (caméra live)

- La caméra capture un frame JPEG toutes les **250ms** (CAPTURE_INTERVAL_MS)
- Sur **native** : `expo-camera` → `takePictureAsync({ base64: true, quality: 0.2 })`
- Sur **web** : `getUserMedia` → canvas → `toDataURL('image/jpeg', 0.2)`
- Le frame base64 est envoyé via WebSocket : `sendFrame("data:image/jpeg;base64,...")`
- Le backend répond avec `{ pred, confidence, hand_detected, landmarks }`
- Le hook `useASLWebSocket` applique le smoothing côté serveur (vote majoritaire, fenêtre 10)
- L'UI affiche la lettre prédite dans `PredictionCard` avec barre de confiance

### 5.2 Détection depuis image (galerie)

1. `expo-image-picker` ouvre la galerie (demande permission sur native)
2. L'image choisie est convertie en `multipart/form-data` (champ `image`)
3. Envoi en `POST /api/v1/predict/image`
4. Le modal d'upload affiche un prévisualisation + résultat (lettre, confiance, statut main)
5. L'utilisateur peut **Accepter** (ajoute au `finalText`) ou **Refuser**
6. Support multi-main : affiche les 2 mains avec lettres individuelles et confiances

### 5.3 Accumulation de lettres en mots

**Mode Manuel (défaut) :**
- `stabilityCounter` s'incrémente à chaque render si `prediction` reste identique
- Seuil : 4 frames stables consécutifs (`STABILITY_REQUIRED = 4`)
- La même lettre ne peut pas être répétée sans être re-prédite (`lastCommittedSign`)
- "space" → espace, "del" → supprime la dernière lettre, lettre → majuscule

**Mode Auto :**
- Intervalle 100ms vérifie confiance ≥ 0.80 ET hand détectée ET délai ≥ 1000ms
- Anti-doublon : même lettre bloquée si la main n'est pas sortie du champ entre deux commits
- Après 3s sans main avec du texte en cours → `Alert.alert()` avec choix Continuer/Effacer

### 5.4 Traduction en arabe (MyMemory API)

```
[ترجمة bouton] → handleTranslate(accumulatedText)
  → setTranslationVisible(true) + setIsTranslating(true)
  → translateToArabic(text)
      GET https://api.mymemory.translated.net/get?q=<text>&langpair=en|ar
      → { responseData: { translatedText: "..." } }
  → setTranslationResult(arabic)
  → <TranslationModal> : texte original + traduction RTL (writingDirection: 'rtl')
```

- Texte traduit : `textAlign: 'right'`, `writingDirection: 'rtl'`, fontSize 20px
- Fallback : "Erreur de traduction" si réseau indisponible ou réponse invalide
- Fonctionne aussi depuis le TextInput manuel

### 5.5 Speech-to-Text (Web Speech API)

- Disponible uniquement sur **Expo Web** (navigateur Chrome/Edge/Safari)
- Bouton 🎤 (44×44px, #6C63FF normal / #e74c3c actif)
- Pendant l'écoute : animation de pulsation (scale 1.0→1.2→1.0, 500ms boucle)
- Placeholder du TextInput change en "Écoute..." rouge
- Résultat vocal remplit automatiquement le `manualInput`
- Second appui pendant l'écoute → arrêt immédiat
- Sur native : `Alert.alert('Non supporté sur cet appareil')`
- Sur web sans support : même alerte

### 5.6 Modes Manuel / Auto

| | Manuel | Auto |
|---|---|---|
| Déclenchement | 4 frames stables | Maintien 1000ms |
| Seuil confiance | 85% | 80% |
| Anti-doublon | Même lettre bloquée | Main doit quitter le champ |
| Timeout sans main | — | Alert après 3s |
| Cooldown | 1000ms | 1000ms |

---

## 6. BUGS TROUVÉS ET CORRIGÉS

| # | Fichier | Description du bug | Correction appliquée |
|---|---|---|---|
| 1 | `App.js` | `formData.append('file', ...)` — le backend FastAPI attend le champ `image` (paramètre `image: UploadFile`), pas `file`. L'upload ne fonctionnait jamais. | Changé en `formData.append('image', ...)` dans les deux branches (web + native) |
| 2 | `App.js` | Le bouton 🎤 était enveloppé dans `{Platform.OS === 'web' && ...}` à l'intérieur du **rendu native** (après le `if (Platform.OS === 'web') return ...`). `Platform.OS` est toujours `'ios'` ou `'android'` dans ce bloc, donc le bouton n'était jamais rendu. Code mort absolu. | Supprimé le guard `Platform.OS === 'web'` autour du bouton mic — il s'affiche maintenant toujours |
| 3 | `App.js` | `handleSpeechToText` retournait silencieusement (`return`) sur les plateformes non-web sans informer l'utilisateur. | Ajout de `Alert.alert('Non supporté sur cet appareil')` avant le `return` sur native |
| 4 | `App.js` | `formData.append('file', ...)` — doublon de la correction #1, corrigé dans les deux branches (web et native) | Voir correction #1 |
| 5 | `App.js` | Styles `finalTextTranslateBtnOff` et `finalTextTranslateTxtOff` référencés dans JSX mais impossibles à différencier visuellement (fond quasi-transparent sur fond transparent) | Remplacés par `opacity: 0.4` inline sur le `TouchableOpacity` — bouton clairement grisé |
| 6 | `App.js` | `finalTextTranslateBtn.backgroundColor: 'rgba(99,102,241,0.2)'` — trop transparent, bouton invisible contre le fond de la caméra | Remplacé par `backgroundColor: '#6C63FF'` solide |
| 7 | `App.js` | `finalTextTranslateTxt.color: '#a5b4fc'` — indigo pâle sur violet, peu lisible | Remplacé par `color: 'white'` |
| 8 | `App.js` | `manualInputRow.gap: 8` — bien que supporté en RN 0.83.6, peut créer des incohérences cross-platform sur Expo Web | Supprimé, remplacé par `marginLeft: 10` sur le bouton translate |
| 9 | `App.js` | `manualTranslateBtn.backgroundColor: 'rgba(99,102,241,0.85)'` — semi-transparent, pas clairement visible | Remplacé par `backgroundColor: '#6C63FF'` solide |
| 10 | `App.js` | `manualInput.backgroundColor: 'rgba(15,23,42,0.9)'` — trop transparent sur fond caméra, TextInput invisible | Remplacé par `backgroundColor: '#1a1a2e'` solide avec bordure visible |
| 11 | `App.js` | `mainContent: { marginBottom: 40 }` — margin excessive réduisait l'espace pour le manualInputRow, risque de clip sur petits écrans | Réduit à `marginBottom: 8` |
| 12 | `App.js` | `handleSpeechToText` sans dépendance `pulseAnim` dans `useCallback` — `pulseAnim` est une `Animated.Value` stable mais sa présence explicite en dépendance rend l'intention claire | Ajout de `[pulseAnim]` dans le tableau de dépendances |
| 13 | `App.js` | Alert d'erreur upload nommée `'Upload Failed'` en anglais | Renommée `'Erreur de détection'` avec message `'Impossible de contacter le serveur.'` |
| 14 | `WordDisplay.js` | `gap: 8` dans `headerActions` — même problème que #8 | Remplacé par `marginRight: 8` sur le bouton translate |

---

## 7. POINTS D'AMÉLIORATION FUTURS

### Backend

1. **CORS** : Ajouter `http://127.0.0.1:8091` aux `cors_origins` pour que la mobile web puisse appeler directement sans proxy.
2. **Test unitaire predict_image** : Le test vérifie `set(payload.keys()) == {'pred', 'confidence', 'hand_detected'}` mais Pydantic v2 sérialise `hands: null` dans la réponse → le test échouera. Il faudrait utiliser `{'pred', 'confidence', 'hand_detected', 'hands'}` ou utiliser `model.model_dump(exclude_none=True)`.
3. **WebSocket : landmarks activés par défaut** : Le client envoie `send_landmarks: true` immédiatement mais le serveur ne les calcule pas jusqu'à réception du control message. Un warmup de 1–2 frames peut arriver sans landmarks.
4. **Rate limiting** : Pas de rate limiting sur le endpoint image — susceptible d'abus si exposé publiquement.
5. **Authentication WebSocket** : Pas d'authentification, n'importe qui sur le réseau peut se connecter.
6. **Graceful shutdown** : Le `hands.close()` dans le lifespan est correct, mais un crash du worker PyTorch pourrait laisser des ressources GPU allouées.

### Mobile

1. **TranslationModal sur Web** : Le `WebLayout` (rendu HTML pur) n'a pas de bouton ترجمة ni de TranslationModal — fonctionnalité disponible uniquement en native. Il faudrait ajouter une zone de traduction au WebLayout.
2. **Mic button sur Web** : Le bouton 🎤 est dans le rendu native uniquement. Sur Expo Web, le rendu passe par `WebLayout` qui ne contient pas ce bouton — il faudrait l'ajouter au WebLayout HTML.
3. **Gestion déconnexion WiFi** : Si le device change de réseau, le WebSocket doit se reconnecter avec le nouvel IP. Ajouter un `NetInfo` listener pour forcer la reconnexion.
4. **Compression frame** : `quality: 0.2` pour les frames WebSocket est agressif. Sur native avec bonne connexion, `quality: 0.4` peut améliorer la précision de détection.
5. **Feedback visuel accumulation** : L'animation de flash vert est gérée différemment sur web (via CSS) et native (via state `flashGreen`). Unifier dans un composant partagé.
6. **Labels langues** : Les messages UI sont mélangés (français, anglais, arabe). Implémenter i18n avec `i18n-js` ou `expo-localization`.
7. **Taille bundle web** : `react-native-reanimated` et `react-native-gesture-handler` augmentent significativement le bundle web même si peu utilisés. Lazy load ou tree-shake.

---

## 8. GUIDE DE DÉMARRAGE

### Backend

```bash
# Depuis la racine du projet
cd backend

# Créer et activer l'environnement virtuel
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS/Linux

# Installer les dépendances
pip install -r requirements.txt

# Lancer le serveur (port 8091)
uvicorn app.main:app --host 0.0.0.0 --port 8091 --reload

# Lancer les tests
pytest tests/
```

Le serveur sera disponible sur :
- API : `http://127.0.0.1:8091/api/v1/`
- WebSocket : `ws://127.0.0.1:8091/api/v1/ws/predict`
- Health : `http://127.0.0.1:8091/api/v1/health`
- Docs Swagger : `http://127.0.0.1:8091/docs`

### Mobile (Expo)

```bash
# Depuis la racine du projet
cd mobile

# Installer les dépendances
npm install

# Lancer pour le navigateur web
npx expo start --web
# → Ouvrir http://localhost:8081 dans Chrome/Edge

# Lancer pour Android (émulateur ou physique)
npx expo start --android

# Lancer pour iOS (simulateur macOS)
npx expo start --ios

# Lancer tout (web par défaut)
npm run start
```

**Configuration réseau :**
- Web browser : Backend sur `127.0.0.1:8091` (même machine) → aucun changement requis
- Émulateur Android : Backend sur `10.0.2.2:8091` → déjà configuré par défaut dans `config.js`
- Device physique : Changer l'IP dans Settings (icône ⚙️) → votre IP locale (ex: `192.168.1.X`)

**Variables d'environnement backend (optionnelles, via `.env`) :**
```
CORS_ORIGINS=["http://localhost:8081","http://127.0.0.1:8081"]
WS_TARGET_FPS=12
CONFIDENCE_THRESHOLD=0.65
```

---

*Rapport généré le 2026-05-21 — Version du projet : 1.0.0*
