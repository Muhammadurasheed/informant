import { API_URL, ENDPOINTS } from '../config';

/**
 * Informant Background Service Worker
 * 
 * Responsibilities:
 * 1. Auth sync — store/retrieve Firebase tokens
 * 2. Screen capture — start/stop MediaRecorder via offscreen document
 * 3. Chunk upload — forward WebM chunks to backend /upload-chunk
 */

let currentAuthToken: string | null = null;
let activeSessionId: string | null = null;
let isCapturing = false;
let indexingPollTimer: ReturnType<typeof setTimeout> | null = null;

// ========== Init ==========

chrome.runtime.onInstalled.addListener(() => {
    console.log('[Informant BG] Installed');
    initializeAuth();
});

chrome.runtime.onStartup.addListener(() => {
    console.log('[Informant BG] Started');
    initializeAuth();
});

// Open side panel on icon click
chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((err) => console.error('[Informant BG] Side panel error:', err));


// ========== Message Router ==========

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {

        case 'REFRESH_TOKEN':
            chrome.storage.local.get(['authToken'], (result) => {
                sendResponse({ token: result.authToken || currentAuthToken });
            });
            return true;

        case 'PROXIED_REQUEST':
            handleProxiedRequest(message, sendResponse);
            return true;

        case 'START_RECORDING':
            startCapture(message.sessionId).then(() => 
                sendResponse({ success: true })
            ).catch((err) => {
                console.error('[Informant BG] Start capture failed:', err);
                sendResponse({ success: false, error: err.message });
            });
            return true;

        case 'STOP_RECORDING':
            stopCapture();
            sendResponse({ success: true });
            break;

        case 'CHUNK_ACQUIRED':
            // Tick up the UI "chunks recorded" counter during capture
            chrome.runtime.sendMessage({
                type: 'CHUNK_ACQUIRED_UI',
                chunkIndex: message.chunkIndex
            });
            broadcastToTabs({ type: 'CHUNK_ACQUIRED_UI', chunkIndex: message.chunkIndex });
            break;

        case 'UPLOAD_STARTED':
            // Relay to sidepanel: show "Uploading to memory..." state
            chrome.runtime.sendMessage({
                type: 'INDEXING_STARTED',
                phase: 'uploading',
                sessionId: message.sessionId
            });
            broadcastToTabs({ type: 'INDEXING_STARTED', phase: 'uploading', sessionId: message.sessionId });
            break;

        case 'UPLOAD_COMPLETE':
            // Call stop-session first to trigger the background indexing task on the backend
            chrome.storage.local.get(['authToken'], (result) => {
                const token = result.authToken || currentAuthToken;
                fetch(`${API_URL}/api/extension/stop-session`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                }).then(() => {
                    chrome.runtime.sendMessage({
                        type: 'INDEXING_STARTED',
                        phase: 'indexing',
                        sessionId: message.sessionId
                    });
                    broadcastToTabs({ type: 'INDEXING_STARTED', phase: 'indexing', sessionId: message.sessionId });
                    startIndexingPoller(message.sessionId);
                }).catch((err) => {
                    console.error('[Informant BG] stop-session failed:', err);
                });
            });
            break;

        case 'UPLOAD_FAILED':
            chrome.runtime.sendMessage({
                type: 'INDEXING_FAILED',
                reason: message.reason,
                detail: message.detail
            });
            broadcastToTabs({ type: 'INDEXING_FAILED', reason: message.reason, detail: message.detail });
            break;

        case 'SIGN_IN_WITH_GOOGLE':
            handleSignIn({ type: 'SIGN_IN_WITH_GOOGLE' });
            break;

        case 'SIGN_IN_WITH_EMAIL':
            handleSignIn({ 
                type: 'SIGN_IN_WITH_EMAIL', 
                email: message.email, 
                password: message.password 
            });
            break;

        case 'SIGN_UP_WITH_EMAIL':
            handleSignIn({ 
                type: 'SIGN_UP_WITH_EMAIL', 
                email: message.email, 
                password: message.password 
            });
            break;

        case 'SIGN_IN_SUCCESS':
            chrome.storage.local.set({ 
                authToken: message.token,
                userProfile: message.user
            }, () => {
                currentAuthToken = message.token;
                chrome.runtime.sendMessage({ type: 'AUTH_STATE_CHANGED', authenticated: true });
            });
            closeOffscreenDoc();
            break;

        case 'CHECK_RECORDING_STATUS':
            sendResponse({ isCapturing, sessionId: activeSessionId });
            return true;

        case 'SIGN_IN_ERROR':
            chrome.runtime.sendMessage({ 
                type: 'AUTH_ERROR', 
                error: message.error,
                code: message.code 
            });
            closeOffscreenDoc();
            break;
    }
});


// ========== Commands (Scene 2 Smart Upgrade) ==========

chrome.commands.onCommand.addListener((command) => {
    console.log('[Informant BG] Command received:', command);
    if (command === 'start-session') {
        handleStartSession();
    } else if (command === 'stop-session') {
        handleStopSession();
    }
});

async function handleStartSession() {
    if (isCapturing) return;
    
    const token = await chrome.storage.local.get(['authToken']).then(r => r.authToken);
    if (!token) {
        console.warn('[Informant BG] Cannot start session: Not authenticated');
        return;
    }
    currentAuthToken = token;

    try {
        const response = await fetch(ENDPOINTS.startSession, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (data.success) {
            const sessionId = data.session?.session_id || `session_${Date.now()}`;
            await startCapture(sessionId);
        }
    } catch (err) {
        console.error('[Informant BG] Failed to start session via shortcut:', err);
    }
}

async function handleStopSession() {
    if (!isCapturing) return;
    await stopCapture();
}


// ========== Screen Capture (Scene 2: SEE) ==========

async function updateActionBadge(active: boolean) {
    if (active) {
        await chrome.action.setBadgeText({ text: 'REC' });
        await chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
    } else {
        await chrome.action.setBadgeText({ text: '' });
    }
}

async function startCapture(sessionId: string) {
    if (isCapturing) return;

    if (!currentAuthToken) {
        const stored = await chrome.storage.local.get(['authToken']);
        if (stored.authToken) currentAuthToken = stored.authToken;
    }

    activeSessionId = sessionId;

    // Ensure offscreen document exists
    await ensureOffscreenDocument('USER_MEDIA', 'Screen capture for Informant memory engine');

    // Get a stream ID from the active tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];

    if (!tab?.id) throw new Error('No active tab found');

    // @ts-ignore
    chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id }, (streamId) => {
        if (chrome.runtime.lastError || !streamId) {
            console.error('[Informant BG] getMediaStreamId failed:', chrome.runtime.lastError?.message);
            return;
        }

        chrome.runtime.sendMessage({
            type: 'START_RECORDING',
            target: 'offscreen',
            streamId,
            sessionId,
            token: currentAuthToken,
            apiUrl: API_URL
        });

        isCapturing = true;
        updateActionBadge(true);
        chrome.runtime.sendMessage({ type: 'CAPTURE_STARTED', sessionId });

        // Signal content script across all active window tabs to show the recording badge (Scene 2)
        chrome.tabs.query({}, (allTabs) => {
            allTabs.forEach(t => {
                if (t.id) {
                    chrome.tabs.sendMessage(t.id, { type: 'SHOW_RECORDING_BADGE' }).catch(() => {});
                }
            });
        });
    });
}

async function stopCapture() {
    isCapturing = false;
    activeSessionId = null;
    updateActionBadge(false);
    chrome.runtime.sendMessage({ type: 'STOP_RECORDING', target: 'offscreen' });
    chrome.runtime.sendMessage({ type: 'CAPTURE_STOPPED' });

    // Signal content script to hide the recording badge across all active tabs
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
            if (tab.id) {
                chrome.tabs.sendMessage(tab.id, { type: 'HIDE_RECORDING_BADGE' }).catch(() => {});
            }
        });
    });
}

// ========== Indexing Status Poller ==========

function startIndexingPoller(sessionId: string) {
    if (indexingPollTimer) clearTimeout(indexingPollTimer);
    let attempts = 0;
    const maxAttempts = 100; // Poll for up to ~5 mins (100 × 3s)

    const poll = async () => {
        attempts++;
        if (attempts > maxAttempts) {
            console.warn('[Informant BG] Indexing poll timed out after', maxAttempts, 'attempts');
            chrome.runtime.sendMessage({
                type: 'INDEXING_FAILED',
                reason: 'timeout',
                detail: 'Indexing took too long — try searching anyway, some content may be available'
            });
            return;
        }

        try {
            const token = await chrome.storage.local.get(['authToken']).then(r => r.authToken);
            if (!token) return;

            const resp = await fetch(`${API_URL}/api/extension/session-status`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!resp.ok) {
                indexingPollTimer = setTimeout(poll, 3000);
                return;
            }

            const data = await resp.json();
            const indexingStatus = data.status?.indexing_status;

            console.log('[Informant BG] Indexing status:', indexingStatus, '(attempt', attempts, ')');

            if (indexingStatus === 'ready') {
                chrome.runtime.sendMessage({
                    type: 'INDEXING_COMPLETE',
                    videosIndexed: data.status?.videos_indexed ?? 0
                });
                broadcastToTabs({ type: 'INDEXING_COMPLETE', videosIndexed: data.status?.videos_indexed ?? 0 });
                return; // Done — stop polling
            } else if (indexingStatus === 'failed') {
                chrome.runtime.sendMessage({
                    type: 'INDEXING_FAILED',
                    reason: 'backend_failed',
                    detail: 'Check backend logs for VideoDB errors'
                });
                broadcastToTabs({ type: 'INDEXING_FAILED', reason: 'backend_failed', detail: 'Check backend logs for VideoDB errors' });
                return;
            }

            // Still uploading/indexing — keep polling
            indexingPollTimer = setTimeout(poll, 3000);
        } catch (err) {
            console.error('[Informant BG] Poll error:', err);
            indexingPollTimer = setTimeout(poll, 3000);
        }
    };

    // Start first poll after 5s (give upload+stop a moment to register)
    indexingPollTimer = setTimeout(poll, 5000);
}

// ========== Navigation Persistence (Scene 2: Persistence) ==========

function broadcastToTabs(message: any) {
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
            if (tab.id) {
                chrome.tabs.sendMessage(tab.id, message).catch(() => {});
            }
        });
    });
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // For SPAs, changeInfo.status might not become 'complete' on every navigation.
    if (isCapturing && tab.active && (changeInfo.status === 'complete' || changeInfo.url)) {
        console.log('[Informant BG] Tab updated/navigated during capture, re-signaling badge');
        chrome.tabs.sendMessage(tabId, { type: 'SHOW_RECORDING_BADGE' }).catch(() => {});
    }
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
    if (isCapturing) {
        chrome.tabs.sendMessage(tabId, { type: 'SHOW_RECORDING_BADGE' }).catch(() => {});
    }
});

// ========== Auth Management ==========

async function handleSignIn(message: any) {
    await ensureOffscreenDocument('DOM_SCRAPING', 'Firebase Auth Proxy');
    
    setTimeout(() => {
        chrome.runtime.sendMessage({
            target: 'offscreen-auth',
            ...message
        });
    }, 200);
}

async function ensureOffscreenDocument(reason: any, justification: string) {
    // @ts-ignore
    if (!(await chrome.offscreen.hasDocument())) {
        // @ts-ignore
        await chrome.offscreen.createDocument({
            url: chrome.runtime.getURL('offscreen.html'),
            reasons: [reason],
            justification: justification
        });
    }
}

async function closeOffscreenDoc() {
    // @ts-ignore
    if (await chrome.offscreen.hasDocument()) {
        // @ts-ignore
        await chrome.offscreen.closeDocument();
    }
}

async function initializeAuth() {
    const result = await chrome.storage.local.get(['authToken']);
    if (result.authToken) {
        currentAuthToken = result.authToken;
    }
}

chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.authToken?.newValue) {
        currentAuthToken = changes.authToken.newValue;
    }
});

async function handleProxiedRequest(message: any, sendResponse: Function) {
    const { url, options } = message;
    const token = currentAuthToken;

    try {
        const headers: Record<string, string> = { ...options.headers };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        if (!headers['Content-Type'] && !options.body?.append) {
            headers['Content-Type'] = 'application/json';
        }

        const response = await fetch(url, { ...options, headers });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            sendResponse({ success: false, error: data.detail || `Error: ${response.status}` });
        } else {
            sendResponse({ success: true, data });
        }
    } catch (error) {
        sendResponse({ success: false, error: 'Network error' });
    }
}
