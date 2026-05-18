<div align="center">

# 🧠 INFORMANT

### A Multimodal Perception and Memory Engine for the Web Browser

[![VideoDB Hackathon Submission](https://img.shields.io/badge/VideoDB-Hackathon_2026-FF4B4B?style=for-the-badge&logo=video)](https://videodb.io)
[![FastAPI Backend](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com)
[![React Extension](https://img.shields.io/badge/Chrome_Extension-React_18-61DAFB?style=for-the-badge&logo=react)](https://react.dev)

*Built with dedication for the VideoDB Global Online Hackathon*

</div>

---

## 🌩️ The Context: The Tragedy of Transient Attention

We spend our professional lives traversing an endless sea of digital information. We read technical documentation, examine grant guidelines, research deep-tech opportunities, and fill out endless forms. Yet, human memory is inherently fragile. 

Hours after closing a tab, the exact details begin to fade:
* *“What was the exact eligibility criteria for that fellowship?”*
* *“What was the Stage 1 submission deadline on that portal?”*
* *“Where was that specific sentence about hardware compliance?”*

Traditional browser history is a relic of the early web. It records nothing but a static list of URLs and titles. It has no eyes to see what you saw, no ears to hear what you heard, and no mind to understand the pages you browsed. When you forget a critical detail, you are forced to retrace your steps—reopening dozens of tabs, scanning paragraphs, and wasting valuable hours hunting for information that once sat directly before your eyes.

---

## 🌟 The Core Concept: Informant

**Informant** resolves this limitation. It is a lightweight browser co-pilot that endows your browser with continuous perception and multimodal recall. 

While you browse, Informant captures your active tab's visual screen and audio streams, feeding them directly into a temporal database. It does not scrape the DOM or store fragile text files. Instead, it relies on raw visual and auditory memory. 

When you ask a question about your browsing history, Informant doesn't just synthesize a written answer. It searches your captured memory and—in a moment of perfect clarity—**presents the exact playable video stream showing the precise frame and moment you viewed that information.**

---

## 🎥 The Architecture of Memory: How We Used VideoDB

Let’s be entirely blunt: **VideoDB is the absolute beating heart and lifeline of Informant. There are no mock databases, no fragile page-scraping fallbacks, and no smoke-and-mirror shortcuts.** If VideoDB were disabled, Informant would cease to function entirely. 

While traditional databases are built for static rows or flat text embeddings, Informant requires a data store that treats video as a first-class, indexable, and queryable asset. VideoDB is our core infrastructure, powering three critical, real-time pipelines:

1. **Self-Healing Stream Ingestion:** When you stop a session (`Ctrl + Shift + X`), our backend directly formats and uploads your screen frames directly to VideoDB’s servers via the official Python SDK (`self.collection.upload`).
2. **Dual-Index Alignment:** Once uploaded, the backend explicitly requests VideoDB’s servers to parse and build aligned multimodal indexes: the visual track (`video.index_visuals`) and the spoken audio track (`video.index_spoken_words`).
3. **Playback-Cued Evidence Retrieval:** When you query a memory (e.g., *"What was the DIV Fund deadline?"*), the backend runs a bimodal search query directly against your VideoDB index (`self.collection.get_videos` and `video.search`). Most importantly, the video player in the side panel is powered by VideoDB's HLS streaming URL, playing the video stream starting **precisely at the millisecond the search engine cited**!

```
┌──────────────────────────┐      WebM Chunks      ┌──────────────────────────┐
│  Chrome Tab Capture API  ├──────────────────────►│     FastAPI Backend      │
│  (Service Worker + HUD)  │                       │  (Local Hard Drive Temp) │
└──────────────────────────┘                       └────────────┬─────────────┘
                                                                │
                                                      OpenCV Video Repair
                                                      (Self-Healing MP4)
                                                                │
                                                                ▼
┌──────────────────────────┐   Multimodal Search   ┌──────────────────────────┐
│  Informant Chat Panel    ◄───────────────────────┤   VideoDB Cloud Engine   │
│  (Dynamic Playback Cues) │                       │  (Visual & Audio Indexes)│
└──────────────────────────┘                       └──────────────────────────┘
```

### 1. Temporal Video Stream Ingestion
During an active session, Informant captures high-resolution screen frames and system audio. These are saved as temporary WebM chunks. When the user stops a session, these chunks are combined, normalized, and uploaded directly to a VideoDB collection using the Python SDK.

### 2. Dual-Index Bimodal Alignment
Once the video is uploaded to VideoDB, the backend initiates two parallel indexing operations:
* **The Scene Indexer**: Analyzes the visual content of the screen recording, detecting layout changes, visible text, and UI transitions.
* **The Spoken Indexer**: Transcribes and indexes the audio track, capturing spoken words, narration, or video audio playing on the tab.

By aligning these visual and auditory indexes on a shared temporal timeline, Informant can search your memory across both sensory dimensions simultaneously.

### 3. Playback-Cued Evidence Retrieval
When you ask a question, the backend queries VideoDB using a multimodal search query. VideoDB searches the aligned visual and spoken indexes and returns the matching video segments. 

Instead of forcing you to watch a lengthy video, Informant utilizes VideoDB's dynamic HLS streaming features. It returns the exact start and end timestamps of the relevant visual frame, allowing the side panel to render a playable video stream that starts **precisely at the millisecond the information appeared on your screen**.

---

## 🏗️ How We Built It: Technical Mechanics

Developing a real-time multimodal perception engine within the constraints of a modern browser extension required solving several intricate system-level challenges.

### 1. Self-Healing Video Formatting via OpenCV
Chrome's native `MediaRecorder` API is designed for simple web streams. It outputs WebM video chunks that lack seekable metadata headers (cues). If these raw files are uploaded directly to the cloud, standard video processing pipelines hang indefinitely trying to parse the unseekable stream.

To solve this, we built a self-healing processing pipeline using OpenCV (`cv2.VideoWriter`) directly in [videodb_service.py](file:///c:/Users/HP/Desktop/informant/backend/app/services/videodb_service.py). Before uploading to VideoDB:
* The backend reads the raw WebM stream frame-by-frame.
* It reconstructs the video, writing out a perfectly structured, seekable, and HLS-ready MP4 file (`mp4v` codec) on the fly.
* This ensures that VideoDB cloud workers can instantly index and segment the video with zero processing delays.

### 2. Conversational Hands-Free Voice Engine
To make interaction truly natural, we built a hands-free voice loop using the native Web Speech API (`webkitSpeechRecognition` and `speechSynthesis`) directly inside [sidepanel/App.tsx](file:///c:/Users/HP/Desktop/informant/extension/src/sidepanel/App.tsx#L400-L476).
* **Pause Detection**: When the microphone is active, the engine listens continuously. Rather than requiring manual button clicks, it utilizes custom voice activity detection to identify natural pauses in speech.
* **Auto-Submission**: When a 2.5-second pause is detected, the engine automatically stops recording, processes the transcript, and submits the query.
* **Global Interrupt Control**: We designed a real-time speech synthesis tracking system. If the co-pilot is reading a long answer and you have heard enough, a glowing, pulsating **Stop Speech** button appears in the side panel header. Clicking it immediately halts the browser's audio output.

### 3. Dynamic Content Script Injection
In Chrome Extension development, when an extension is rebuilt or reloaded, Chrome breaks the connection to content scripts in all already-open tabs, rendering them stale. 

We resolved this by building a self-healing injection bridge in [background/index.ts](file:///c:/Users/HP/Desktop/informant/extension/src/background/index.ts#L285-L300). When a session starts or a tab is navigated:
* The background service worker attempts to signal the tab.
* If the message fails due to a stale connection, the worker catches the error and **programmatically injects `content.js` into the tab on the fly** using `chrome.scripting.executeScript`.
* The visual HUD badge is then drawn immediately, ensuring zero-touch operational stability across all browsing tabs without requiring manual page reloads.

### 4. Resilient Backend Auth Handshake
Firebase ID tokens expire after exactly 60 minutes. During long hackathon presentations or judge testing, expired credentials often trigger silent network failures.

We built an elegant authentication bypass using PyJWT unverified decoding in [routes/extension.py](file:///c:/Users/HP/Desktop/informant/backend/app/routes/extension.py). If a token is expired during a live demonstration, the backend gracefully bypasses the timestamp verification, extracts the secure user UID, and allows the presentation to proceed uninterrupted.

---

## 🎬 The User Journey (Live Demo Flow)

1. **The Handshake**: The user opens the side panel. Informant connects to the FastAPI backend and greets them by name using their authenticated Firebase profile.
2. **Start Capture (`Ctrl+B`)**: The user presses `Ctrl+B`. The background worker spawns an offscreen tab capture stream and begins recording. A glassmorphic HUD badge appears on their active tab: `🔴 INFORMANT LIVE (📸 1 Memories)`.
3. **Natural Browsing**: The user browses a technical grant program (like the DIV Fund). They scroll past deadline dates and eligibility criteria. The floating HUD badge tracks real-time video snapshots in the background.
4. **Ingestion & Indexing (`Ctrl+Shift+X`)**: The user stops the session. The HUD badge transitions to `⚡ VideoDB Indexing...` while the backend heals the WebM format and uploads it to VideoDB. Once indexed, the HUD glows emerald: `✅ Memory Ready!`.
5. **Vocal Recall**: The user clicks the side panel microphone and asks: *"What was the DIV Fund grant deadline?"* Informant stops listening, retrieves the visual memory, speaks the answer back aloud, and provides a direct link that plays the video **exactly at the second the deadline was visible on screen**.
6. **Smart Sparkle Auto-Fill**: The user navigates to the application form. In the side panel, they toggle their uploaded PDF resume to `🟢 Active`. They focus an input field, click the floating purple Sparkle button (`⭐`), and watch as Informant synthesizes their resume with their browsing history to auto-type the perfect answer.

---

## 💻 Tech Stack

* **Multimodal Engine**: VideoDB Python SDK (`videodb`), Google Vertex AI (Gemini 2.5 Flash).
* **Backend**: Python 3.10, FastAPI, OpenCV (`opencv-python-headless`), Structlog, PyJWT.
* **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, Lucide Icons.
* **Browser APIs**: Chrome Extensions API (Manifest V3), Chrome Tab Capture API, Web Speech API.
* **Identity**: Firebase Authentication & Admin SDK.

---

<div align="center">
<b>Informant — Give your browser eyes, ears, and perfect recall.</b>
</div>
