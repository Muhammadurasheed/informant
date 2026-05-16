import { isExtensionValid } from '../config';

/**
 * Unified API Helper for ScholarStream Co-Pilot
 * Handles CORS and Auth by proxying requests through the Background Script when needed.
 */

export interface ProxiedResponse {
    success: boolean;
    data?: any;
    error?: string;
    status?: number;
}

/**
 * authorizedFetch: The smart fetcher that knows where it is.
 * - In SidePanel: Uses direct fetch (CORS allowed).
 * - In Content Script: Proxies via Background Script (bypass CORS).
 */
export async function authorizedFetch(
    url: string,
    options: RequestInit = {}
): Promise<ProxiedResponse> {
    const isContentScript = typeof window !== 'undefined' && !!document.getElementById('scholarstream-root');

    // 1. Determine context (Background script vs Content Script)
    // Note: Background script and side panel have similar privileges.
    // We'll use a simple check for chrome.runtime.sendMessage which side panel can do.

    if (isContentScript) {
        // We are in the content script - must proxy to background to bypass CORS
        if (!isExtensionValid()) {
            return { success: false, error: 'Extension context invalidated. Please refresh the page.' };
        }

        return new Promise((resolve) => {
            chrome.runtime.sendMessage(
                {
                    type: 'PROXIED_REQUEST',
                    url,
                    options: {
                        method: options.method || 'GET',
                        headers: options.headers || {},
                        body: options.body instanceof FormData ? null : options.body, // FormData can't be JSON serialized easily
                        // For now, we handle JSON bodies. If we need FormData (e.g. for doc parsing), 
                        // we might need a separate message type or utility.
                    },
                },
                (response) => {
                    if (chrome.runtime.lastError) {
                        resolve({ success: false, error: chrome.runtime.lastError.message });
                    } else {
                        resolve(response);
                    }
                }
            );
        });
    }

    // 2. Direct fetch for Background/Sidepanel context
    try {
        const response = await fetch(url, options);
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            return {
                success: false,
                error: data.detail || `Server error: ${response.status}`,
                status: response.status
            };
        }

        return { success: true, data };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Network error'
        };
    }
}
