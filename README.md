# Qplus Voice Assistant

## Overview
Qplus is a professional, real-time browser-based voice assistant designed to demonstrate advanced voice interaction capabilities using WebRTC, Web Audio API, and state-of-the-art AI models. It features a low-latency pipeline that integrates **Groq (Whisper)** for Speech-to-Text (STT) and **Google Cloud (WaveNet)** for Text-to-Speech (TTS), orchestrated by a Node.js proxy server.

The system is capable of wake word detection ("Hey Qplus"), intelligent intent understanding via a local knowledge base, and natural voice response, making it suitable for automated customer support and intelligent workflow management scenarios.

---

##  Architecture

### High-Level Design (HLD)
The architecture follows a **Client-Server** model designed to offload sensitive API handling to the server while keeping the interaction logic responsive on the client.

1.  **Client (Browser)**: Handles audio capture, wake word detection, silence detection, and plays back audio responses. It manages the conversation flow and queries the local knowledge base.
2.  **Proxy Server (Node.js)**: Acts as a secure gateway. It authenticates with third-party APIs (Groq, Google Cloud) so that API keys are never exposed to the browser. It communicates with the client via **WebSockets** for real-time data transfer.
3.  **AI Services**:
    *   **STT**: Groq API (Whisper Large V3 Turbo) for ultra-fast transcription.
    *   **TTS**: Google Cloud Text-to-Speech (WaveNet) for natural-sounding voice synthesis.

### Low-Level Design (LLD) & Data Flow

#### 1. Audio Capture & Wake Word (Client)
*   **Module**: `AudioCapture` & `WakeWordDetector`
*   **Tech**: Web Audio API, AudioWorklet.
*   **Flow**:
    *   Microphone input is captured at **16kHz, Mono, 16-bit PCM**.
    *   Audio is analyzed locally for the wake word "Hey Qplus" (using energy detection or Picovoice Porcupine if configured).
    *   Upon detection, the system enters the "Listening" state.

#### 2. Speech-to-Text (Streaming)
*   **Module**: `STTService` (Client) & `handleSTTConnection` (Server)
*   **Flow**:
    *   Client streams raw PCM audio chunks to the Proxy Server via WebSocket.
    *   Proxy buffers audio and sends it to **Groq's Whisper API**.
    *   Groq returns the text transcript to the Proxy, which forwards it to the Client.

#### 3. Intelligence & Logic (Client)
*   **Module**: `KnowledgeBase`
*   **Flow**:
    *   The client receives the transcript (e.g., "What is Qplus?").
    *   It performs a fuzzy match search against the local `knowledge_base.json`.
    *   The best matching answer is selected (e.g., "Qplus is an AI platform...").

#### 4. Text-to-Speech (Response)
*   **Module**: `TTSService` (Client) & `handleTTSConnection` (Server)
*   **Flow**:
    *   Client sends the answer text to the Proxy Server via WebSocket.
    *   Proxy sends the text to **Google Cloud TTS**.
    *   Google returns audio content (MP3/WAV).
    *   Proxy forwards the audio binary to the Client.
    *   `AudioPlayback` module queues and plays the audio to the user.

---

## Prerequisites

Before running the project, ensure you have the following:

1.  **Node.js**: v16.0.0 or higher.
2.  **Groq API Key**: For the Whisper STT model.
3.  **Google Cloud Service Account**:
    *   Enabled **Cloud Text-to-Speech API**.
    *   Created Service account with specific permissions.
    *   Downloaded JSON key file.

---

## Installation & Setup

### 1. Clone the Repository
```bash
git clone <repository-url>
cd webrtc_voice_pipeline
```

### 2. Install Dependencies
Install the required Node.js packages for the proxy server:
```bash
npm install
```

### 3. Environment Configuration
Create a .env file in the root directory to store your sensitive keys.

**File:** .env
```env
# Groq API Key for Whisper STT
GROQ_API_KEY=gsk_your_groq_api_key_here

# Path to your Google Cloud Service Account JSON file
GOOGLE_APPLICATION_CREDENTIALS=wavenet_tts_service_account.json
```

### 4. Google Cloud Credentials
Place your Google Cloud Service Account JSON file in the root directory and rename it to wavenet_tts_service_account.json (or update the path in .env).

---

## Running the Application

### 1. Start the Proxy Server
The proxy server handles the WebSocket connections and API calls.
```bash
npm start
```
*Output should indicate: `✓ WebSocket Proxy Server running on ws://localhost:8080, ✓ Groq API Key loaded: gsk_BrUqdy..., ✓ Google Credentials: wavenet_tts_service_account.json, Ready to proxy STT (Groq) and TTS (Google)`*

### 2. Serve the Frontend
Since the project uses ES6 Modules (`import`/`export`), you cannot simply open index.html in a browser. You must serve it using a local web server.

**Using npx**
```bash
# npx manager
npx http-server -p 8000
```
Then open `http://localhost:8000` in your browser (safari,chrome,edge).

### 3. Usage
1.  Click the **Start** button on the web interface.
2.  Allow microphone permissions when prompted.
3.  Say **"Hey Qplus"** (or speak loudly if using energy detection fallback).
4.  Ask a question like: *"What is Qplus?"* or *"Who created you?"*.
5.  The system will transcribe your speech, find the answer, and speak it back to you.

---

## Project Structure

```
webrtc_voice_pipeline/
├── assets/                 # Static assets (assessment doc)
├── js/
│   ├── audio/              # Audio processing modules
│   │   ├── worklets/       # AudioWorklets for non-blocking processing
│   │   ├── audioCapture.js # Microphone handling
│   │   └── audioPlayback.js# Audio response playback
│   ├── services/           # Service integrations
│   │   ├── knowledgeBase.js# Local Q&A logic
│   │   ├── sttService.js   # Speech-to-Text WebSocket client
│   │   └── ttsService.js   # Text-to-Speech WebSocket client
│   ├── ui/                 # UI manipulation logic
│   ├── wakeword/           # Wake word detection logic
│   ├── config.js           # Central configuration
│   └── main.js             # Application entry point
├── index.html              # Main user interface
├── knowledge_base.json     # Database of questions and answers
├── package.json            # Project dependencies
├── proxy_server.js         # Node.js backend (API Gateway)
└── style.css               # Application styling
```

## Technical Specifications

*   **Audio Format**: 16kHz Sample Rate, 1 Channel (Mono), 16-bit Bit Depth.
*   **Latency Targets**:
    *   Target: < 800ms
    *   Warning: > 1200ms
    *   Critical: > 1500ms
*   **Chunk Size**: 20ms audio chunks (320 samples) for minimal buffer delay.
*   **Silence Detection**: RMS threshold-based detection to automatically stop listening after user finishes speaking (800ms silence duration).

## Troubleshooting

*   **Microphone Error**: Ensure your browser has permission to access the microphone and that the site is served over `localhost` or HTTPS.
*   **WebSocket Error**: Ensure `npm start` is running and the port 8080 is not blocked.
*   **API Errors**: Check the server console logs. Ensure your `GROQ_API_KEY` is valid and the Google Cloud JSON file has the correct permissions.
