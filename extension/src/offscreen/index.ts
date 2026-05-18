import { initializeApp } from 'firebase/app';
import { 
    getAuth, 
    GoogleAuthProvider, 
    signInWithPopup, 
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    setPersistence,
    indexedDBLocalPersistence
} from 'firebase/auth';

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
setPersistence(auth, indexedDBLocalPersistence);

let mediaRecorder: MediaRecorder | null = null;
let currentStream: MediaStream | null = null;
let currentToken: string | null = null;
let currentApiUrl: string | null = null;

// Handle messages from the background script
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    // Auth Logic
    if (message.target === 'offscreen-auth') {
        if (message.type === 'SIGN_IN_WITH_GOOGLE') {
            try {
                const provider = new GoogleAuthProvider();
                const result = await signInWithPopup(auth, provider);
                const idToken = await result.user.getIdToken();
                sendAuthSuccess(idToken, result.user);
            } catch (error: any) {
                sendAuthError(error);
            }
        } else if (message.type === 'SIGN_IN_WITH_EMAIL') {
            try {
                const result = await signInWithEmailAndPassword(auth, message.email, message.password);
                const idToken = await result.user.getIdToken();
                sendAuthSuccess(idToken, result.user);
            } catch (error: any) {
                sendAuthError(error);
            }
        } else if (message.type === 'SIGN_UP_WITH_EMAIL') {
            try {
                const result = await createUserWithEmailAndPassword(auth, message.email, message.password);
                const idToken = await result.user.getIdToken();
                sendAuthSuccess(idToken, result.user);
            } catch (error: any) {
                sendAuthError(error);
            }
        }
    }

    // Recorder Logic
    if (message.target === 'offscreen') {
        if (message.type === 'START_RECORDING') {
            currentToken = message.token;
            currentApiUrl = message.apiUrl;
            startRecording(message.streamId, message.sessionId);
        } else if (message.type === 'STOP_RECORDING') {
            stopRecording();
        }
    }
});

function sendAuthSuccess(token: string, user: any) {
    chrome.runtime.sendMessage({
        target: 'background',
        type: 'SIGN_IN_SUCCESS',
        token,
        user: {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL
        }
    });
}

function sendAuthError(error: any) {
    chrome.runtime.sendMessage({
        target: 'background',
        type: 'SIGN_IN_ERROR',
        error: error.message,
        code: error.code
    });
}

async function startRecording(streamId: string, sessionId: string) {
    if (mediaRecorder) {
        console.warn('Already recording');
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                // @ts-ignore
                mandatory: {
                    chromeMediaSource: 'tab',
                    chromeMediaSourceId: streamId
                }
            },
            video: {
                // @ts-ignore
                mandatory: {
                    chromeMediaSource: 'tab',
                    chromeMediaSourceId: streamId
                }
            }
        });

        currentStream = stream;
        mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'video/webm; codecs=vp9',
            videoBitsPerSecond: 1000000 // 1Mbps is enough for screen capture
        });

        const recordedChunks: Blob[] = [];

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                recordedChunks.push(event.data);
                // Send a lightweight signal to tick up the UI counter!
                chrome.runtime.sendMessage({
                    type: 'CHUNK_ACQUIRED',
                    chunkIndex: recordedChunks.length
                });
            }
        };

        mediaRecorder.onstop = async () => {
            console.log('[Informant Offscreen] Recording stopped, preparing upload blob...');
            // Use plain video/webm — no codec suffix avoids malformed container issues
            const blob = new Blob(recordedChunks, { type: 'video/webm' });
            const blobSize = blob.size;
            console.log(`[Informant Offscreen] Blob ready: ${(blobSize / 1024 / 1024).toFixed(2)} MB`);

            if (!currentToken || !currentApiUrl || !sessionId) {
                console.warn('[Informant Offscreen] Missing credentials — skipping upload');
                chrome.runtime.sendMessage({ type: 'UPLOAD_FAILED', reason: 'missing_credentials' });
                mediaRecorder = null;
                recordedChunks.length = 0;
                return;
            }

            if (blobSize < 1024) {
                console.warn('[Informant Offscreen] Blob too small, skipping upload');
                chrome.runtime.sendMessage({ type: 'UPLOAD_FAILED', reason: 'blob_too_small' });
                mediaRecorder = null;
                recordedChunks.length = 0;
                return;
            }

            // Notify background that upload is starting (sidepanel shows spinner)
            chrome.runtime.sendMessage({ type: 'UPLOAD_STARTED', sessionId, blobSize });

            try {
                const formData = new FormData();
                formData.append('file', blob, `session_${sessionId}_${Date.now()}.webm`);
                formData.append('session_id', sessionId);

                console.log('[Informant Offscreen] Uploading to backend...');
                const response = await fetch(`${currentApiUrl}/api/extension/upload-chunk`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${currentToken}` },
                    body: formData
                });

                if (response.ok) {
                    const data = await response.json();
                    console.log('[Informant Offscreen] ✅ Upload successful:', data);
                    // Background will start polling /session-status for indexing progress
                    chrome.runtime.sendMessage({
                        type: 'UPLOAD_COMPLETE',
                        sessionId,
                        chunkIndex: data.chunk_index ?? 0,
                        blobSize
                    });
                } else {
                    const errText = await response.text().catch(() => 'unknown');
                    console.error('[Informant Offscreen] ❌ Upload failed:', response.status, errText);
                    chrome.runtime.sendMessage({
                        type: 'UPLOAD_FAILED',
                        reason: `http_${response.status}`,
                        detail: errText
                    });
                }
            } catch (uploadErr) {
                console.error('[Informant Offscreen] ❌ Upload network error:', uploadErr);
                chrome.runtime.sendMessage({
                    type: 'UPLOAD_FAILED',
                    reason: 'network_error',
                    detail: String(uploadErr)
                });
            } finally {
                mediaRecorder = null;
                recordedChunks.length = 0;
                currentToken = null;
                currentApiUrl = null;
            }
        };

        // Record continuously but fire ondataavailable every 5 seconds to tick the UI counter
        mediaRecorder.start(5000);
        console.log('MediaRecorder started for session:', sessionId);

    } catch (err) {
        console.error('Failed to start MediaRecorder:', err);
    }
}

function stopRecording() {
    if (mediaRecorder) {
        mediaRecorder.stop();
    }
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        currentStream = null;
    }
}
