# ScholarStream Co-Pilot Extension - Testing Guide

This guide walks you through building, installing, and testing the Chrome extension.

---

## Prerequisites

1. **Node.js** (v18+) installed
2. **Chrome browser** 
3. **Backend running** (optional but recommended for full functionality)

---

## Step 1: Configure Environment

1. Navigate to the extension folder:
   ```bash
   cd extension
   ```

2. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

3. Edit `.env` with your values:
   ```env
   VITE_API_URL=http://localhost:8081
   VITE_FIREBASE_API_KEY=your_firebase_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   ```

   > **Tip**: Use the same Firebase config as your main web app.

---

## Step 2: Install Dependencies & Build

```bash
# Install dependencies
npm install

# Build the extension
npm run build
```

This creates a `dist/` folder with the compiled extension.

---

## Step 3: Load Extension in Chrome

1. Open Chrome and go to: `chrome://extensions/`

2. Enable **"Developer mode"** (toggle in top-right corner)

3. Click **"Load unpacked"**

4. Select the `extension/dist` folder

5. The ScholarStream Co-Pilot should now appear in your extensions!

6. **Pin it**: Click the puzzle piece icon → Pin ScholarStream

---

## Step 4: Test the Extension

### Test 1: Login Flow

1. Click the extension icon in Chrome toolbar
2. The sidebar panel should open
3. Enter your ScholarStream credentials (same as web app)
4. Click **Sign In**
5. ✅ You should see the main chat interface with context status

### Test 2: Context Status Panel

After logging in, you should see:
- **Profile**: Shows completeness percentage (e.g., "65%")
- **Document**: Shows "No document" or uploaded file name
- **Platform**: Detects current website (DevPost, DoraHacks, etc.)

### Test 3: Document Upload

1. Click **"Upload Doc"** button
2. Select a `.txt`, `.md`, `.pdf`, or `.docx` file
3. ✅ For PDF/DOCX: Should show "Processing..." then success message
4. ✅ For text files: Should load immediately
5. Check the context status shows the document name

### Test 4: Sparkle Button (Field Auto-Fill)

1. Go to a hackathon submission page:
   - DevPost: https://devpost.com (find any active hackathon)
   - DoraHacks: https://dorahacks.io

2. Click on any text input field (e.g., "Project Name", "Description")

3. A **sparkle button** (⭐) should appear near the field

4. Click the sparkle:
   - If no profile/doc: Shows **guidance bubble** with options
   - If context available: Generates content with **typewriter effect**
   - After generation: Shows **thought bubble** with AI reasoning

### Test 5: Auto-Fill All

1. On a form page with multiple fields
2. Click the **"Auto-Fill"** button in the sidebar header
3. ✅ Should fill multiple fields and show success message

### Test 6: Chat with Co-Pilot

1. Type a question in the sidebar: "Help me write an elevator pitch"
2. ✅ Should get a contextual response using your profile/document
3. Try: "What should I include in the technical description?"

### Test 7: Profile Sync

1. Click the **refresh icon** (🔄) next to Profile percentage
2. ✅ Should sync latest profile from Firebase
3. Check if completeness percentage updates

---

## Step 5: Test with Backend (Full Features)

For full AI-powered features, run the backend:

```bash
# In the backend folder
cd backend
pip install -r requirements.txt
python run.py
```

Ensure your `.env` points to `http://localhost:8081`

---

## Troubleshooting

### Extension not loading?
- Check Chrome console: Right-click extension icon → Inspect popup → Console
- Ensure `dist/` folder has `manifest.json`

### Login not working?
- Verify Firebase config in `.env`
- Check browser console for Firebase errors
- Ensure you're using the same credentials as the web app

### Sparkle not appearing?
- Refresh the page after installing extension
- Check if the input field is a supported type (not file/hidden/submit)

### API errors?
- Ensure backend is running on the correct port
- Check CORS settings in backend
- Verify `VITE_API_URL` in `.env`

### Document upload failing?
- Check file size (max 5MB)
- Ensure backend `/api/documents/parse` endpoint is available
- For PDF/DOCX, backend needs `PyPDF2` and `python-docx` installed

---

## Development Mode

For hot-reloading during development:

```bash
npm run dev
```

Then reload the extension in Chrome after changes.

---

## File Structure

```
extension/
├── dist/                 # Built extension (load this in Chrome)
├── src/
│   ├── background/       # Service worker
│   ├── content/          # Content script (Sparkle engine)
│   ├── sidepanel/        # Sidebar UI (React)
│   ├── utils/            # Firebase, DOM scanner
│   └── config.ts         # API endpoints, helpers
├── public/
│   └── manifest.json     # Extension manifest
├── .env.example          # Environment template
└── package.json
```

---

## Next Steps

1. Complete your profile at https://scholarstream..app/profile
2. Add projects, experience, and essays in the CV Builder tab
3. Upload a project README to the extension for hackathon submissions
4. Navigate to DevPost/DoraHacks and let the AI help you fill forms!

---

**Allahu Musta'an** - May your applications be successful! 🚀
