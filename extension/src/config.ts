/**
 * Informant Extension Configuration
 * Central config for the AI browser co-pilot
 */

// API endpoint — local dev or Cloud Run
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8081';

// Derived API endpoints
export const ENDPOINTS = {
    // Session management (Scenes 2 & Stop)
    startSession:    `${API_URL}/api/extension/start-session`,
    stopSession:     `${API_URL}/api/extension/stop-session`,
    sessionStatus:   `${API_URL}/api/extension/session-status`,
    uploadChunk:     `${API_URL}/api/extension/upload-chunk`,

    // Memory recall (Scene 5 — the mind-blown moment)
    searchMemory:    `${API_URL}/api/extension/search-memory`,

    // Chat (Side panel conversation)
    chat:            `${API_URL}/api/extension/chat`,

    // Sparkle auto-fill
    mapFields:       `${API_URL}/api/extension/map-fields`,

    // User profile
    userProfile:     `${API_URL}/api/extension/user-profile`,

    // Document parsing
    parseDocument:   `${API_URL}/api/extension/documents/parse`,

    // Browsing History Dashboard
    history:         `${API_URL}/api/extension/history`,
};

// ========== Document Types ==========

export interface UploadedDocument {
    id: string;
    filename: string;
    content: string;
    uploadedAt: number;
    charCount: number;
    fileType: string;
}

export interface ContextStatus {
    hasDocument: boolean;
    documentName: string | null;
    documentCharCount: number;
    pageUrl: string;
    isProcessing: boolean;
    processingError: string | null;
    isSessionActive: boolean;
    sessionId: string | null;
    chunkCount: number;
    videosIndexed: number;
}

// ========== Helpers ==========

/**
 * Parse a document via backend API
 */
export async function parseDocument(
    file: File,
    authToken: string
): Promise<{
    success: boolean;
    content: string;
    charCount: number;
    fileType: string;
    error?: string;
}> {
    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch(ENDPOINTS.parseDocument, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` },
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `Server error: ${response.status}`);
        }

        const data = await response.json();
        return {
            success: true,
            content: data.content,
            charCount: data.char_count,
            fileType: data.file_type,
        };
    } catch (error) {
        return {
            success: false,
            content: '',
            charCount: 0,
            fileType: 'unknown',
            error: error instanceof Error ? error.message : 'Failed to parse document',
        };
    }
}

/**
 * Generate a unique document ID
 */
export function generateDocumentId(): string {
    return `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Check if the extension runtime is still valid
 */
export function isExtensionValid(): boolean {
    return typeof chrome !== 'undefined' && !!chrome.runtime && !!chrome.runtime.id;
}

/**
 * Get a safe reference to chrome.storage.local
 */
export function getStorage() {
    if (!isExtensionValid()) {
        console.warn('[Informant] Extension context lost. Please refresh the page.');
        return null;
    }
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
        console.warn('[Informant] Storage API unavailable.');
        return null;
    }
    return chrome.storage.local;
}
