# 🧭 TESTING GUIDE

### A Step-by-Step Walkthrough for Hackathon Judges and Evaluators

Welcome to the evaluator's guide for **Informant**. This document provides precise instructions to set up, launch, and fully validate Informant's multimodal perception, memory, and action engine in your local browser environment.

---

## 📋 Prerequisites

Before beginning, ensure your local system has the following runtime environments installed:
1. **Python 3.10+**: Required to run the FastAPI backend and VideoDB integration.
2. **Node.js 18+**: Required to compile the Chrome Extension source code.
3. **Google Chrome**: The target browser for the Extension.
4. **VideoDB API Key**: A valid API key from [VideoDB](https://videodb.io).

---

## ⚡ Step 1: Set Up the FastAPI Backend

The backend acts as the coordination layer, handling formatting repairs via OpenCV, Firebase authentication decoding, and sending queries to VideoDB.

1. **Navigate to the backend directory**:
   ```bash
   cd backend
   ```

2. **Configure your environment**:
   Create a `.env` file in the `backend/` directory (you can copy `.env.example` if present) and add the following keys:
   ```env
   VIDEODB_API_KEY=your_videodb_api_key_here
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

3. **Install system-level dependencies (if on Windows)**:
   Ensure you have a modern terminal or command prompt ready. The backend utilizes OpenCV for video format repairs.
   
4. **Create a virtual environment & install dependencies**:
   ```bash
   python -m venv venv
   # On Windows:
   venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate

   pip install -r requirements.txt
   ```

5. **Launch the backend server**:
   ```bash
   python run.py
   ```
   The backend will start and listen on port `8081` (`http://localhost:8081`). Keep this terminal open.

---

## 🧭 Step 2: Build the Chrome Extension

The extension provides the perception layer (screen capture) and the visual user interface (side panel and floating tab badge).

1. **Navigate to the extension directory**:
   ```bash
   cd extension
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Compile the production bundle**:
   ```bash
   npm run build
   ```
   This will compile the TypeScript source files and output a completely self-contained extension bundle in `extension/dist/`.

---

## 🔌 Step 3: Load the Extension into Google Chrome

1. Open Google Chrome and navigate to: `chrome://extensions/`.
2. Toggle the **"Developer mode"** switch in the top-right corner of the window.
3. Click the **"Load unpacked"** button in the top-left corner.
4. Select the **`extension/dist/`** directory in the file dialog.
5. **Pin the Extension**: Click the puzzle piece icon in the Chrome toolbar and pin **Informant**.

---

## 🎬 Step 4: The Evaluation Walkthrough (Demo Scenario)

Follow these steps to experience the complete Informant user journey:

### 1. Launch & Authentication
* Click the Informant extension icon in your Chrome toolbar.
* The side panel will slide open.
* Click the **"Try Guest Mode"** or sign in with your email/Firebase credentials. 
* Once logged in, the system will greet you and enter "Memory Standby" mode.

### 2. Grant Microphone Permissions
* Click the **microphone icon** next to the chat input field.
* A temporary Chrome tab will open to ask for microphone access.
* Click **Allow** and close the tab. This permanently authorizes Informant's voice mode.

### 3. Initiate Screen Perception (`Ctrl+B`)
* Navigate to a dense technical webpage, such as a hackathon submission guideline page or a grant opportunity website.
* Press **`Ctrl+B`** on your keyboard (or click **▶ Start Session** in the sidepanel).
* You will instantly see a beautiful glassmorphic HUD badge appear in the top-right corner of your active tab showing:
  **`🔴 INFORMANT LIVE (📸 1 Memories)`**

### 4. Natural Browsing
* Scroll slowly through the web page. Allow the browser to capture key information like deadlines, funding amounts, eligibility rules, and technical requirements.
* You will see the visual memory count on the floating badge increment every few seconds.

### 5. Ingestion & Visual Repair (`Ctrl+Shift+X`)
* Once you have finished browsing, press **`Ctrl+Shift+X`** (or click **Stop** in the side panel).
* The floating badge will instantly transition to:
  **`⚡ VideoDB Indexing...`**
* In the background, the FastAPI server receives the captured WebM chunks, runs our self-healing OpenCV script to rewrite the stream headers into seekable MP4 structures, and uploads them directly to your VideoDB collection.
* Once the indexing is complete, the badge will glow emerald:
  **`✅ Memory Ready!`**

### 6. Perfect Recall (Voice or Chat)
* Click the **microphone icon** in the side panel and ask a question about what you just browsed:
  * *“What was the submission deadline on that platform?”*
  * *“What are the eligibility requirements?”*
* Wait a moment after speaking. The voice engine will automatically detect your silence, submit the question, synthesize the answer, and **speak the response out loud**.
* Crucially, a video player will appear in the chat panel with a clickable link. Click it to watch the exact visual proof—playing **precisely at the frame and second you saw that detail on screen**.

### 7. Active Document Sparkle Fill
* Navigate to any text input form or registration field.
* Go to the **Knowledge Base** tab in the side panel, click **Upload Doc**, and upload a `.txt` or `.pdf` file (such as your resume or abstract). Make sure it is toggled to **🟢 Active**.
* Focus the input field on the webpage. A floating purple Sparkle icon (**`⭐`**) will appear next to the field.
* Click the Sparkle icon. Informant will read the active document context, combine it with your VideoDB browsing memories, and automatically typewrite a perfect response directly into the form!

---

## 🛠️ Troubleshooting & Diagnostics

### 1. Stale Extension Contexts
If you rebuild or reload the extension in `chrome://extensions`, Chrome breaks the background connection to currently open tabs.
* **The Self-Healing Fix**: Simply reload your active web tab once, or switch tabs. Informant's auto-injection helper will automatically re-inject the content script and display the badge instantly.

### 2. Video Processing Hangs
If the indexing status appears stuck, ensure you have `ffmpeg` or `opencv-python-headless` properly configured. Our backend uses OpenCV as a local pre-processor to guarantee HLS seekability, shielding VideoDB cloud decoders from raw WebM parser crashes.

---

<div align="center">
<b>Thank you for evaluating Informant! May your recall be flawless.</b>
</div>
