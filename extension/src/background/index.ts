import { API_URL } from '../config';

// Background Service Worker for Informant Co-Pilot
// Handles Auth Sync and VideoDB Capture Sessions

let currentAuthToken: string | null = null;

// Initialize on install
chrome.runtime.onInstalled.addListener(() => {
    console.log("Informant Co-Pilot Installed");
    initializeAuth();
});

// Also run on startup
chrome.runtime.onStartup.addListener(() => {
    console.log("Informant Co-Pilot Started");
    initializeAuth();
});

// Configure Side Panel behavior
chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error(error));

// Listen for messages from Content Script or Side Panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'OPEN_SIDE_PANEL') {
        if (sender.tab && sender.tab.windowId) {
            chrome.sidePanel.open({ windowId: sender.tab.windowId })
                .catch((error) => console.error("Failed to open panel:", error));
        }
    } else if (message.type === 'REFRESH_TOKEN') {
        chrome.storage.local.get(['authToken'], (result) => {
            sendResponse({ token: result.authToken || currentAuthToken });
        });
        return true; // Keep message channel open
    } else if (message.type === 'PROXIED_REQUEST') {
        const { url, options } = message;

        // Ensure we have a token
        chrome.storage.local.get(['authToken'], async (result) => {
            const token = result.authToken || currentAuthToken;

            try {
                const headers = {
                    ...options.headers,
                    'Content-Type': options.headers['Content-Type'] || 'application/json',
                };

                if (token) {
                    headers['Authorization'] = `Bearer ${token}`;
                }

                const response = await fetch(url, {
                    ...options,
                    headers
                });

                const data = await response.json().catch(() => ({}));

                if (!response.ok) {
                    sendResponse({
                        success: false,
                        error: data.detail || `Server error: ${response.status}`,
                        status: response.status
                    });
                } else {
                    sendResponse({ success: true, data });
                }
            } catch (error) {
                sendResponse({
                    success: false,
                    error: error instanceof Error ? error.message : 'Network error'
                });
            }
        });
        return true; // Keep message channel open
    } else if (message.type === 'START_RECORDING') {
        startCapture(message.sessionId);
    } else if (message.type === 'STOP_RECORDING') {
        stopCapture();
    } else if (message.type === 'RECORDING_CHUNK') {
        uploadChunk(message.chunk, message.sessionId);
    }
});

async function startCapture(sessionId: string) {
    // 1. Create offscreen document if it doesn't exist
    if (!(await (chrome.offscreen as any).hasDocument())) {
        await (chrome.offscreen as any).createDocument({
            url: 'offscreen.html',
            reasons: [(chrome.offscreen as any).Reason.USER_MEDIA],
            justification: 'Capture screen for AI co-pilot memory'
        });
    }

    // 2. Get stream ID
    chrome.desktopCapture.chooseDesktopMedia(['screen', 'window', 'tab'], (streamId) => {
        if (!streamId) {
            console.error("No stream ID returned");
            return;
        }

        // 3. Tell offscreen doc to start recording
        chrome.runtime.sendMessage({
            type: 'START_RECORDING',
            target: 'offscreen',
            streamId,
            sessionId
        });
    });
}

async function stopCapture() {
    chrome.runtime.sendMessage({
        type: 'STOP_RECORDING',
        target: 'offscreen'
    });
}

async function uploadChunk(chunkDataUrl: string, sessionId: string) {
    if (!currentAuthToken) return;

    try {
        // Convert Data URL to Blob
        const blob = await (await fetch(chunkDataUrl)).blob();
        const formData = new FormData();
        formData.append('file', blob, `chunk_${Date.now()}.webm`);
        formData.append('session_id', sessionId);

        const response = await fetch(`${API_URL}/api/extension/upload-chunk`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${currentAuthToken}`
            },
            body: formData
        });

        if (!response.ok) {
            console.error("Chunk upload failed", await response.text());
        }
    } catch (err) {
        console.error("Error uploading chunk:", err);
    }
}


// Listen for auth token changes from content script
chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.authToken) {
        const newToken = changes.authToken.newValue;
        if (newToken && newToken !== currentAuthToken) {
            console.log('🔑 [BG] New auth token received, reconnecting WebSocket...');
            currentAuthToken = newToken;
            reconnectWithNewToken();
        }
    }
});

// --- Unified Auth Listener (Web App -> Extension) ---
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
    // 1. Security Check: Validate Sender Origin
    const allowedOrigins = [
        'http://localhost:8081',
        'http://localhost:8080',
        'http://localhost:5173',
        'https://scholarstream.app',
        'https://scholarstream-frontend-1086434452502.us-central1.run.app',
        'https://scholarstream-frontend-opdnpd6bsq-uc.a.run.app',
    ];

    const origin = sender.url ? new URL(sender.url).origin : '';
    if (!allowedOrigins.includes(origin)) {
        console.warn(`[Auth] Blocked message from unauthorized origin: ${origin}`);
        return; // Ignore unauthorized messages
    }

    // 2. Handle Sync Message
    if (message.type === 'SYNC_AUTH' && message.token) {
        console.log(`[Auth] Received Token from ${origin}`);

        // Save to storage (triggers the onChanged listener above)
        chrome.storage.local.set({
            authToken: message.token,
            userProfile: message.user || {}
        }, () => {
            console.log("[Auth] Token synced to storage!");
            sendResponse({ success: true });
        });

        // Return true to indicate async response
        return true;
    }
});

// --- Auth Initialization ---
async function initializeAuth() {
    // Try to get stored token
    const result = await chrome.storage.local.get(['authToken']);
    if (result.authToken) {
        currentAuthToken = result.authToken;
        console.log('🔑 [BG] Found existing auth token');
        connectWebSocket();
    } else {
// Initial Auth Check
initializeAuth();
