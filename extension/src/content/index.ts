// ========== IN-LINED DISTINGUISHED DEPS (Prevent ESM Chunks) ==========

/**
 * Extension Configuration (In-lined for Content Script Stability)
 * CRITICAL: Do NOT use import.meta here. Content scripts are NOT modules
 * and the browser parser will throw a SyntaxError even on 'typeof import.meta'.
 */
const API_URL = 'https://scholarstream-backend-1086434452502.us-central1.run.app';
const ENDPOINTS = {
    chat: `${API_URL}/api/extension/chat`,
    mapFields: `${API_URL}/api/extension/map-fields`,
    userProfile: `${API_URL}/api/extension/user-profile`,
    saveApplicationData: `${API_URL}/api/extension/save-application-data`,
    parseDocument: `${API_URL}/api/documents/parse`,
    supportedTypes: `${API_URL}/api/documents/supported-types`,
};

/**
 * Storage Safety Helpers (In-lined)
 */
function isExtensionValid(): boolean {
    return typeof chrome !== 'undefined' && !!chrome.runtime && !!chrome.runtime.id;
}

function getStorage() {
    if (!isExtensionValid()) return null;
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return null;
    return chrome.storage.local;
}

/**
 * Proxied Fetch for Content Script (In-lined)
 * Routes requests through the background script to bypass CORS.
 */
async function proxiedFetch(url: string, options: any = {}): Promise<any> {
    if (!isExtensionValid()) {
        throw new Error('Extension context lost. Please refresh the page.');
    }

    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
            {
                type: 'PROXIED_REQUEST',
                url,
                options: {
                    method: options.method || 'GET',
                    headers: options.headers || {},
                    body: options.body
                }
            },
            (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }
                if (!response.success) {
                    reject(new Error(response.error || 'Request failed'));
                    return;
                }
                resolve({
                    ok: true,
                    json: async () => response.data,
                    text: async () => JSON.stringify(response.data),
                    status: response.status || 200
                });
            }
        );
    });
}

/**
 * DOM Scanner (In-lined)
 */
function getPageContext() {
    const title = document.title;
    const url = window.location.href;
    const clone = document.body.cloneNode(true) as HTMLElement;
    const scripts = clone.getElementsByTagName('script');
    while (scripts[0]) scripts[0].parentNode?.removeChild(scripts[0]);
    const styles = clone.getElementsByTagName('style');
    while (styles[0]) styles[0].parentNode?.removeChild(styles[0]);
    const content = clone.innerText || "";
    const inputs = Array.from(document.querySelectorAll('input, textarea, select')).map((el, index) => {
        const element = el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
        const rect = element.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0 || element.type === 'hidden') return null;
        return {
            id: element.id || `input_${index}`,
            name: element.name,
            type: element.type,
            placeholder: 'placeholder' in element ? element.placeholder : '',
            label: "", // Simplified for in-line stability
            value: element.value,
            selector: "#" + (element.id || `input_${index}`)
        };
    }).filter(Boolean);

    return { title, url, content: content.substring(0, 50000), forms: inputs };
}

// ========== CONTENT SCRIPT LOGIC ==========
console.log("ScholarStream Content Script Loaded (Self-Contained Mode)");

// ========== ENHANCED FIELD CONTEXT (Phase 3) ==========
interface FieldContext {
    // Basic
    id: string;
    name: string;
    label: string;
    placeholder: string;
    type: string;
    selector: string;

    // Enhanced (Phase 3)
    characterLimit?: number;
    wordLimit?: number;
    format: 'plain' | 'markdown' | 'html';
    isRequired: boolean;
    surroundingContext: string;
    platformHint: string;
    fieldCategory: FieldCategory;

    // Page context
    pageTitle: string;
    pageUrl: string;
}

type FieldCategory =
    | 'elevator_pitch'
    | 'description'
    | 'inspiration'
    | 'technical'
    | 'challenges'
    | 'team'
    | 'personal_info'
    | 'links'
    | 'generic';

// Platform-specific tips for thought bubble
const PLATFORM_TIPS: Record<string, string[]> = {
    DevPost: [
        "DevPost judges love clear problem statements",
        "Mention specific technologies and APIs used",
        "Highlight what makes your solution unique",
        "Include demo links or video if available"
    ],
    DoraHacks: [
        "Emphasize blockchain/Web3 aspects if relevant",
        "Highlight technical innovation",
        "Mention open-source contributions",
        "Show traction or community interest"
    ],
    MLH: [
        "Focus on what you learned during the hackathon",
        "Highlight team collaboration",
        "Mention any sponsors' technologies you used",
        "Be enthusiastic and authentic"
    ],
    Default: [
        "Be specific and avoid generic statements",
        "Use concrete examples and numbers",
        "Keep it concise but impactful",
        "Proofread for clarity"
    ]
};

// ===== UNIFIED AUTH SYNC: Listen for custom events from ScholarStream web app =====
// This is the Google-style zero-config approach (no extension ID needed)
window.addEventListener('scholarstream-auth-sync', ((event: CustomEvent) => {
    const { token, user } = event.detail || {};
    if (!token) return;

    console.log('🔑 [EXT] Auth sync event received from web app!');

    const storage = getStorage();
    if (!storage) return;

    storage.set({
        authToken: token,
        userProfile: user || {}
    }, () => {
        console.log('✅ [EXT] Auth synced to extension storage');
    });
}) as EventListener);

window.addEventListener('scholarstream-auth-logout', () => {
    console.log('🚪 [EXT] Logout event received');
    const storage = getStorage();
    if (storage) {
        storage.remove(['authToken', 'userProfile', 'lastLoggedToken']);
    }
});

// ===== FALLBACK: Also poll localStorage for auth token (for pages already loaded) =====
if (window.location.host.includes('localhost') || window.location.host.includes('scholarstream') || window.location.host.includes('us-central1.run.app')) {
    const extractAndSendToken = () => {
        let token = localStorage.getItem('scholarstream_auth_token');

        // Check if token exists in firebase auto-storage if not in our custom key
        if (!token) {
            Object.keys(localStorage).forEach(key => {
                if (key.includes('firebase:authUser')) {
                    try {
                        const userData = JSON.parse(localStorage.getItem(key) || '{}');
                        if (userData.stsTokenManager && userData.stsTokenManager.accessToken) {
                            token = userData.stsTokenManager.accessToken;
                        }
                    } catch (e) {
                        // ignore parse errors
                    }
                }
            });
        }

        if (token) {
            const storage = getStorage();
            if (storage) {
                storage.get(['authToken'], (result) => {
                    // Only update if different (avoid unnecessary writes)
                    if (result.authToken !== token) {
                        storage.set({ authToken: token }, () => {
                            console.log('🔑 [EXT] Auth token synced via localStorage');
                        });
                    }
                });
            }
        }
    };

    // Listen for storage events (emitted when web app signs in)
    window.addEventListener('storage', (e) => {
        if (e.key === 'scholarstream_auth_token' || (e.key && e.key.includes('firebase:authUser'))) {
            console.log('🔄 [EXT] Storage event detected: Syncing auth...');
            extractAndSendToken();
        }
    });

    // Also poll periodically as a failsafe
    extractAndSendToken();
    setInterval(extractAndSendToken, 5000);
}

// ===== INTELLIGENT SPARKLE ENGINE (Phase 3) =====
class FocusEngine {
    private activeElement: HTMLElement | null = null;
    private sparkleBtn: HTMLDivElement;
    private tooltip: HTMLDivElement;
    private thoughtBubble: HTMLDivElement;
    private guidanceBubble: HTMLDivElement;
    private refinementOverlay: HTMLDivElement; // NEW: In-field refinement
    private isStreaming = false;
    private isDragging = false;
    private dragOffset = { x: 0, y: 0 };
    private sparkleHidden = false;
    private lastFilledElement: HTMLElement | null = null; // Track last filled element

    constructor() {
        this.sparkleBtn = this.createSparkleButton();
        this.tooltip = this.createTooltip();
        this.thoughtBubble = this.createThoughtBubble();
        this.guidanceBubble = this.createGuidanceBubble();
        this.refinementOverlay = this.createRefinementOverlay(); // NEW
        this.initListeners();
    }

    private createSparkleButton(): HTMLDivElement {
        const container = document.createElement('div');
        container.id = 'ss-sparkle-container';
        container.style.cssText = `
            position: absolute;
            display: none;
            z-index: 2147483647;
            cursor: grab;
        `;

        const btn = document.createElement('div');
        btn.id = 'ss-sparkle-trigger';
        btn.style.cssText = `
            width: 32px;
            height: 32px;
            background: linear-gradient(135deg, #FF6B6B, #4ECDC4);
            border-radius: 50%;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            display: flex;
            align-items: center;
            justify-content: center;
            transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
            animation: ss-pulse 2s infinite;
        `;
        btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"></path></svg>`;

        const closeBtn = document.createElement('div');
        closeBtn.id = 'ss-sparkle-close';
        closeBtn.style.cssText = `
            position: absolute;
            top: -8px;
            right: -8px;
            width: 18px;
            height: 18px;
            background: #ef4444;
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: bold;
            color: white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            opacity: 0;
            transition: opacity 0.2s;
        `;
        closeBtn.innerHTML = '×';

        container.appendChild(btn);
        container.appendChild(closeBtn);

        container.onmouseenter = () => {
            closeBtn.style.opacity = '1';
            if (!this.isDragging) btn.style.transform = 'scale(1.1)';
        };
        container.onmouseleave = () => {
            closeBtn.style.opacity = '0';
            btn.style.transform = 'scale(1)';
        };

        const style = document.createElement('style');
        style.textContent = `
            @keyframes ss-pulse { 0% { box-shadow: 0 0 0 0 rgba(78, 205, 196, 0.7); } 70% { box-shadow: 0 0 0 10px rgba(78, 205, 196, 0); } 100% { box-shadow: 0 0 0 0 rgba(78, 205, 196, 0); } }
            @keyframes ss-typewriter { from { width: 0; } to { width: 100%; } }
            @keyframes ss-fade-in-up { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            #ss-sparkle-container.dragging { cursor: grabbing !important; }
            @keyframes ss-bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
            @keyframes ss-spin { to { transform: rotate(360deg); } }
        `;
        document.head.appendChild(style);
        document.body.appendChild(container);

        btn.onclick = (e) => {
            if (this.isDragging) return;
            e.preventDefault();
            e.stopPropagation();
            this.handleSparkleClick();
        };

        closeBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.sparkleHidden = true;
            this.hideSparkle();
        };

        container.onmousedown = (e) => {
            if ((e.target as HTMLElement).id === 'ss-sparkle-close') return;
            this.isDragging = true;
            container.classList.add('dragging');
            const rect = container.getBoundingClientRect();
            this.dragOffset = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
        };

        document.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;
            container.style.left = `${e.clientX - this.dragOffset.x + window.scrollX}px`;
            container.style.top = `${e.clientY - this.dragOffset.y + window.scrollY}px`;
        });

        document.addEventListener('mouseup', () => {
            if (this.isDragging) {
                this.isDragging = false;
                container.classList.remove('dragging');
            }
        });

        return container as HTMLDivElement;
    }

    private createTooltip() {
        const div = document.createElement('div');
        div.style.cssText = `
            position: absolute;
            display: none;
            background: #1e293b;
            color: #fff;
            padding: 8px 12px;
            border-radius: 8px;
            font-size: 12px;
            font-family: sans-serif;
            z-index: 2147483647;
            pointer-events: none;
            white-space: nowrap;
            box-shadow: 0 4px 6px rgba(0,0,0,0.3);
        `;
        div.innerText = "✨ Auto-Fill with ScholarStream";
        document.body.appendChild(div);
        return div;
    }

    private createThoughtBubble() {
        const div = document.createElement('div');
        div.id = 'ss-thought-bubble';
        div.style.cssText = `
            position: absolute;
            display: none;
            background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
            color: #e2e8f0;
            padding: 14px 18px;
            border-radius: 12px;
            border: 1px solid #334155;
            font-size: 13px;
            font-family: 'Inter', system-ui, sans-serif;
            line-height: 1.5;
            max-width: 360px;
            z-index: 2147483647;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
            pointer-events: none;
            opacity: 0;
            transform: translateY(10px);
            transition: opacity 0.3s, transform 0.3s;
        `;
        document.body.appendChild(div);
        return div;
    }

    private createGuidanceBubble() {
        const div = document.createElement('div');
        div.id = 'ss-guidance-bubble';
        div.style.cssText = `
            position: absolute;
            display: none;
            background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
            color: #e2e8f0;
            padding: 16px;
            border-radius: 12px;
            border: 1px solid #3b82f6;
            font-size: 13px;
            font-family: 'Inter', system-ui, sans-serif;
            line-height: 1.5;
            max-width: 320px;
            z-index: 2147483647;
            box-shadow: 0 10px 25px -5px rgba(59, 130, 246, 0.3);
            opacity: 0;
            transform: translateY(10px);
            transition: opacity 0.3s, transform 0.3s;
        `;
        document.body.appendChild(div);
        return div;
    }

    // NEW: Create Refinement Overlay (Double-click to refine)
    private createRefinementOverlay(): HTMLDivElement {
        const overlay = document.createElement('div');
        overlay.id = 'ss-refinement-overlay';
        overlay.style.cssText = `
            position: absolute;
            display: none;
            z-index: 2147483647;
            background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
            border: 1px solid #3b82f6;
            border-radius: 12px;
            padding: 12px;
            box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.5);
            min-width: 320px;
            max-width: 420px;
            font-family: system-ui, -apple-system, sans-serif;
        `;

        // Add internal style for scrollbar in the overlay
        const style = document.createElement('style');
        style.textContent = `
            #ss-refinement-input::-webkit-scrollbar {
                width: 6px;
            }
            #ss-refinement-input::-webkit-scrollbar-track {
                background: transparent;
            }
            #ss-refinement-input::-webkit-scrollbar-thumb {
                background: rgba(71, 85, 105, 0.4);
                border-radius: 10px;
            }
            #ss-refinement-input::-webkit-scrollbar-thumb:hover {
                background: rgba(71, 85, 105, 0.7);
            }
        `;
        overlay.appendChild(style);

        overlay.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
                <div style="width: 24px; height: 24px; background: linear-gradient(135deg, #FF6B6B, #4ECDC4); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"></path></svg>
                </div>
                <span style="font-size: 13px; font-weight: 600; color: #e2e8f0; font-family: system-ui, sans-serif;">Refine Content</span>
                <button id="ss-refinement-close" style="margin-left: auto; background: none; border: none; color: #64748b; cursor: pointer; font-size: 18px; padding: 0;">×</button>
            </div>
            <textarea 
                id="ss-refinement-input" 
                placeholder="e.g., Make it more detailed, add my Python experience..."
                style="width: 100%; padding: 10px 12px; background: #0f172a; border: 1px solid #334155; border-radius: 8px; color: #e2e8f0; font-size: 13px; font-family: system-ui, sans-serif; outline: none; box-sizing: border-box; min-height: 42px; max-height: 120px; resize: none; overflow-y: auto; line-height: 1.4;"
                rows="1"
            ></textarea>
            <div style="display: flex; gap: 8px; margin-top: 10px;">
                <button id="ss-refinement-expand" style="flex: 1; padding: 8px 12px; background: #1e293b; border: 1px solid #334155; border-radius: 6px; color: #94a3b8; font-size: 12px; cursor: pointer; font-family: system-ui, sans-serif;">📝 More detailed</button>
                <button id="ss-refinement-concise" style="flex: 1; padding: 8px 12px; background: #1e293b; border: 1px solid #334155; border-radius: 6px; color: #94a3b8; font-size: 12px; cursor: pointer; font-family: system-ui, sans-serif;">✂️ More concise</button>
                <button id="ss-refinement-submit" style="flex: 1; padding: 8px 12px; background: #3b82f6; border: none; border-radius: 6px; color: white; font-size: 12px; font-weight: 600; cursor: pointer; font-family: system-ui, sans-serif;">Refine ✨</button>
            </div>
        `;
        document.body.appendChild(overlay);

        // Event listeners for refinement
        overlay.querySelector('#ss-refinement-close')?.addEventListener('click', () => this.hideRefinementOverlay());
        overlay.querySelector('#ss-refinement-expand')?.addEventListener('click', () => this.applyQuickRefinement('Make this response more detailed and comprehensive. Add specific examples and elaborate on key points.'));
        overlay.querySelector('#ss-refinement-concise')?.addEventListener('click', () => this.applyQuickRefinement('Make this response more concise and to the point. Remove unnecessary words while keeping the core message.'));
        overlay.querySelector('#ss-refinement-submit')?.addEventListener('click', () => this.submitRefinement());

        // Auto-grow textarea
        const textarea = overlay.querySelector('#ss-refinement-input') as HTMLTextAreaElement;
        textarea?.addEventListener('input', (e) => {
            const target = e.target as HTMLTextAreaElement;
            target.style.height = 'auto';
            target.style.height = Math.min(target.scrollHeight, 120) + 'px';
        });
        textarea?.addEventListener('keydown', (e) => {
            if ((e as KeyboardEvent).key === 'Enter' && !(e as KeyboardEvent).shiftKey) {
                e.preventDefault();
                this.submitRefinement();
            }
            if ((e as KeyboardEvent).key === 'Escape') this.hideRefinementOverlay();
        });

        return overlay;
    }


    private initListeners() {
        document.addEventListener('focusin', (e) => this.handleFocus(e), true);
        document.addEventListener('scroll', () => this.updatePosition(), true);
        window.addEventListener('resize', () => this.updatePosition());

        // NEW: Double-click listener for refinement on filled fields
        document.addEventListener('dblclick', (e) => this.handleDoubleClick(e), true);
    }

    // NEW: Handle double-click for refinement
    private handleDoubleClick(e: MouseEvent) {
        const target = e.target as HTMLElement;
        if (!target) return;

        // Only trigger on input/textarea that has content
        if (!['INPUT', 'TEXTAREA'].includes(target.tagName)) return;

        const input = target as HTMLInputElement | HTMLTextAreaElement;
        if (input.type === 'file' || input.type === 'hidden' || input.type === 'submit') return;

        // Only show refinement if field has content (likely AI-filled)
        if (!input.value || input.value.trim().length < 20) return;

        // Prevent text selection on double-click
        e.preventDefault();

        this.lastFilledElement = input;
        this.showRefinementOverlay(input);
    }

    private showRefinementOverlay(target: HTMLElement) {
        const rect = target.getBoundingClientRect();
        const top = rect.bottom + window.scrollY + 8;
        const left = rect.left + window.scrollX;

        this.refinementOverlay.style.top = `${top}px`;
        this.refinementOverlay.style.left = `${left}px`;
        this.refinementOverlay.style.display = 'block';

        // Focus the input
        setTimeout(() => {
            (this.refinementOverlay.querySelector('#ss-refinement-input') as HTMLInputElement)?.focus();
        }, 100);
    }

    private hideRefinementOverlay() {
        this.refinementOverlay.style.display = 'none';
        (this.refinementOverlay.querySelector('#ss-refinement-input') as HTMLInputElement).value = '';
    }

    private async applyQuickRefinement(instruction: string) {
        (this.refinementOverlay.querySelector('#ss-refinement-input') as HTMLInputElement).value = instruction;
        await this.submitRefinement();
    }

    private async submitRefinement() {
        if (!this.lastFilledElement) return;

        const input = this.lastFilledElement as HTMLInputElement | HTMLTextAreaElement;
        const refinementInput = this.refinementOverlay.querySelector('#ss-refinement-input') as HTMLTextAreaElement;
        const instruction = refinementInput.value.trim();

        if (!instruction) {
            refinementInput.style.borderColor = '#ef4444';
            setTimeout(() => refinementInput.style.borderColor = '#334155', 1000);
            return;
        }

        const currentContent = input.value;
        const fieldContext = this.analyzeField(input);

        // Show loading state on button
        const submitBtn = this.refinementOverlay.querySelector('#ss-refinement-submit') as HTMLButtonElement;
        const originalText = submitBtn.innerText;
        submitBtn.innerText = 'Refining...';
        submitBtn.disabled = true;

        // FAANG UX: Hide overlay and show "Refining..." feedback on the INPUT FIELD ITSELF immediately
        this.hideRefinementOverlay();

        // Show refinement progress indicator on the field
        this.showEnhancedReasoning(
            `🔄 Refining: "${instruction.slice(0, 40)}..."`,
            input,
            fieldContext,
            false
        );

        try {
            const { userProfile, projectContext, instruction: kbInstruction } = await resolveDistinguishedContext(fieldContext);
            const storage = getStorage();
            if (!storage) throw new Error('Extension context invalidated');

            // CRITICAL: Request token refresh from extension before API call
            let authToken = (await storage.get(['authToken'])).authToken;
            try {
                const refreshResponse = await chrome.runtime.sendMessage({ type: 'REFRESH_TOKEN' });
                if (refreshResponse && refreshResponse.token) {
                    authToken = refreshResponse.token;
                    console.log('🔄 [Sparkle] Token refreshed via background sync');
                }
            } catch (msgErr) {
                console.warn('⚠️ [Sparkle] Could not request token refresh (sidepanel might be closed)', msgErr);
            }

            if (!authToken) throw new Error('Not authenticated');

            const refinementPrompt = `TASK: Refine the following content based on user instruction.
Maintain Distinguished Engineer standards: Absolute factual grounding, technical precision, and Socratic intent.

CURRENT CONTENT:
${currentContent}

USER INSTRUCTION: ${instruction}

${kbInstruction}

IMPORTANT:
1. Apply the user's specific refinement instruction while strictly adhering to the Project Context in the and Einstein Grounding rules.
2. Return ONLY the refined content, no explanations.`;

            const response = await proxiedFetch(ENDPOINTS.mapFields, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    form_fields: [],
                    user_profile: userProfile,
                    target_field: {
                        ...fieldContext,
                        existingContent: currentContent
                    },
                    project_context: projectContext,
                    instruction: refinementPrompt
                })
            });

            if (!response.ok) throw new Error('Refinement failed');

            const data = await response.json();
            const refinedContent = data.sparkle_result?.content || data.filled_value || currentContent;

            // Apply refined content with typewriter effect
            await this.typewriterEffect(input, refinedContent);

            // Show success feedback - replace the "Refining..." with success
            this.showEnhancedReasoning(
                `✅ Refined based on: "${instruction.slice(0, 50)}..."`,
                input,
                fieldContext,
                false
            );

        } catch (error) {
            console.error('Refinement failed:', error);
            // Show error on the field
            this.showEnhancedReasoning(
                `❌ Refinement failed. Try again.`,
                input,
                fieldContext,
                false
            );
        } finally {
            submitBtn.innerText = originalText;
            submitBtn.disabled = false;
        }
    }

    private handleFocus(e: FocusEvent) {
        const target = e.target as HTMLElement;
        if (!target) return;

        if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) && !target.isContentEditable) {
            this.hideSparkle();
            return;
        }

        const input = target as HTMLInputElement;
        if (input.type === 'file' || input.type === 'hidden' || input.type === 'submit' || input.type === 'image') {
            this.hideSparkle();
            return;
        }

        this.activeElement = target;
        this.showSparkle(target);
    }

    private showSparkle(target: HTMLElement) {
        if (!target || this.sparkleHidden) return;
        const rect = target.getBoundingClientRect();

        const top = rect.top + window.scrollY + (rect.height / 2) - 16;
        const left = rect.right + window.scrollX - 40;

        this.sparkleBtn.style.top = `${top}px`;
        this.sparkleBtn.style.left = `${left}px`;
        this.sparkleBtn.style.display = 'flex';

        this.tooltip.style.top = `${top - 30}px`;
        this.tooltip.style.left = `${left - 60}px`;
    }

    private hideSparkle() {
        this.sparkleBtn.style.display = 'none';
        this.tooltip.style.display = 'none';
        this.thoughtBubble.style.opacity = '0';
        this.hideGuidanceBubble();
    }

    private updatePosition() {
        if (this.activeElement && this.sparkleBtn.style.display !== 'none') {
            this.showSparkle(this.activeElement);
        }
    }

    // ========== ENHANCED THOUGHT BUBBLE (Phase 3) ==========
    private showEnhancedReasoning(
        reasoning: string,
        target: HTMLElement,
        fieldContext: FieldContext,
        wasTemplateUsed: boolean
    ) {
        if (!target) return;

        const rect = target.getBoundingClientRect();
        const top = rect.bottom + window.scrollY + 8;
        const left = rect.left + window.scrollX;

        // Get platform-specific tips
        const platformTips = PLATFORM_TIPS[fieldContext.platformHint] || PLATFORM_TIPS.Default;
        const randomTip = platformTips[Math.floor(Math.random() * platformTips.length)];

        // Build thought bubble content
        let content = `<div style="margin-bottom: 8px;"><span style="color: #4ECDC4; font-weight: 600;">🧠 AI Thought:</span> ${reasoning}</div>`;

        // Add character/word limit info if applicable
        if (fieldContext.characterLimit) {
            content += `<div style="font-size: 11px; color: #94a3b8; margin-bottom: 6px;">📏 Character limit: ${fieldContext.characterLimit}</div>`;
        }
        if (fieldContext.wordLimit) {
            content += `<div style="font-size: 11px; color: #94a3b8; margin-bottom: 6px;">📝 Word limit: ~${fieldContext.wordLimit}</div>`;
        }

        // Add format hint
        if (fieldContext.format === 'markdown') {
            content += `<div style="font-size: 11px; color: #60a5fa; margin-bottom: 6px;">📑 Markdown formatting supported</div>`;
        }

        // Add platform tip
        content += `<div style="font-size: 11px; color: #fbbf24; margin-top: 8px; padding-top: 8px; border-top: 1px solid #334155;">💡 Tip: ${randomTip}</div>`;

        // Add template warning if used
        if (wasTemplateUsed) {
            content += `<div style="font-size: 11px; color: #f87171; margin-top: 6px;">⚠️ Template used - replace [BRACKETS] with your info</div>`;
        }

        this.thoughtBubble.innerHTML = content;
        this.thoughtBubble.style.top = `${top}px`;
        this.thoughtBubble.style.left = `${left}px`;
        this.thoughtBubble.style.maxWidth = `${Math.min(360, window.innerWidth - left - 20)}px`;
        this.thoughtBubble.style.display = 'block';

        void this.thoughtBubble.offsetWidth;

        this.thoughtBubble.style.opacity = '1';
        this.thoughtBubble.style.transform = 'translateY(0)';

        // Auto-hide after 12 seconds (longer for templates and refinements)
        const hideDelay = wasTemplateUsed ? 15000 : 12000;
        setTimeout(() => {
            this.thoughtBubble.style.opacity = '0';
            this.thoughtBubble.style.transform = 'translateY(10px)';
            setTimeout(() => {
                if (this.thoughtBubble.style.opacity === '0') {
                    this.thoughtBubble.style.display = 'none';
                }
            }, 300);
        }, hideDelay);
    }

    private showGuidanceBubble(target: HTMLElement, hasProfile: boolean, hasDocument: boolean, fieldType: string) {
        const rect = target.getBoundingClientRect();
        const top = rect.bottom + window.scrollY + 8;
        const left = rect.left + window.scrollX;

        let message = '';
        let buttons = '';

        if (!hasProfile && !hasDocument) {
            message = `
                <div style="margin-bottom: 8px; font-weight: 600; color: #fbbf24;">🤔 I can help, but I don't know much about you yet.</div>
                <div style="color: #94a3b8; margin-bottom: 12px;">
                    For a <strong>great ${fieldType}</strong>, I need:
                    <ul style="margin: 8px 0 0 16px; padding: 0;">
                        <li>Your project details (upload via sidebar)</li>
                        <li>Your background (complete your profile)</li>
                    </ul>
                </div>
            `;
            buttons = `
                <button id="ss-guidance-upload" style="flex: 1; background: #3b82f6; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 12px;">Upload Doc</button>
                <button id="ss-guidance-profile" style="flex: 1; background: #1e293b; color: #94a3b8; border: 1px solid #334155; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 12px;">Complete Profile</button>
                <button id="ss-guidance-try" style="flex: 1; background: #1e293b; color: #4ade80; border: 1px solid #22c55e; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 12px;">Try Anyway</button>
            `;
        } else if (!hasDocument) {
            message = `
                <div style="margin-bottom: 8px; font-weight: 600; color: #60a5fa;">💡 I'll use your profile, but I don't have project context.</div>
                <div style="color: #94a3b8; margin-bottom: 12px;">
                    Upload a project README or description for better results on this ${fieldType} field.
                </div>
            `;
            buttons = `
                <button id="ss-guidance-upload" style="flex: 1; background: #3b82f6; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 12px;">Upload Doc</button>
                <button id="ss-guidance-try" style="flex: 1; background: #22c55e; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 12px;">Generate Anyway</button>
            `;
        }

        this.guidanceBubble.innerHTML = `
            ${message}
            <div style="display: flex; gap: 8px; margin-top: 8px;">
                ${buttons}
            </div>
        `;

        this.guidanceBubble.style.top = `${top}px`;
        this.guidanceBubble.style.left = `${left}px`;
        this.guidanceBubble.style.display = 'block';
        this.guidanceBubble.style.pointerEvents = 'auto';

        void this.guidanceBubble.offsetWidth;

        this.guidanceBubble.style.opacity = '1';
        this.guidanceBubble.style.transform = 'translateY(0)';

        setTimeout(() => {
            document.getElementById('ss-guidance-upload')?.addEventListener('click', () => {
                // Use safe sender to avoid unhandled promise rejections when the service worker is sleeping/reloading.
                void safeSendMessage({ type: 'OPEN_SIDE_PANEL' });
                this.hideGuidanceBubble();
            });
            document.getElementById('ss-guidance-profile')?.addEventListener('click', () => {
                window.open('https://scholarstream-frontend-1086434452502.us-central1.run.app/profile', '_blank');
                this.hideGuidanceBubble();
            });
            document.getElementById('ss-guidance-try')?.addEventListener('click', () => {
                this.hideGuidanceBubble();
                this.generateWithAvailableContext();
            });
        }, 100);
    }

    private hideGuidanceBubble() {
        this.guidanceBubble.style.opacity = '0';
        this.guidanceBubble.style.transform = 'translateY(10px)';
        setTimeout(() => {
            this.guidanceBubble.style.display = 'none';
        }, 300);
    }

    // ========== ENHANCED FIELD ANALYSIS (Phase 3) ==========
    private analyzeField(target: HTMLInputElement | HTMLTextAreaElement): FieldContext {
        const label = this.getLabel(target);
        const placeholder = target.placeholder || '';
        const combinedText = (label + ' ' + placeholder).toLowerCase();

        // Detect character/word limits
        const characterLimit = this.detectCharacterLimit(target);
        const wordLimit = this.detectWordLimit(target, label);

        // Detect format (markdown support)
        const format = this.detectFormat(target, combinedText);

        // Get surrounding context (nearby headings, descriptions)
        const surroundingContext = this.getSurroundingContext(target);

        // Detect platform
        const platformHint = this.detectPlatform();

        // Categorize field
        const fieldCategory = this.categorizeFieldEnhanced(label, placeholder, surroundingContext);

        return {
            id: target.id,
            name: target.name || '',
            label,
            placeholder,
            type: target.type || target.tagName.toLowerCase(),
            selector: uniqueSelector(target),
            characterLimit,
            wordLimit,
            format,
            isRequired: target.required || target.hasAttribute('aria-required'),
            surroundingContext,
            platformHint,
            fieldCategory,
            pageTitle: document.title,
            pageUrl: window.location.href,
        };
    }

    private detectCharacterLimit(target: HTMLInputElement | HTMLTextAreaElement): number | undefined {
        // Check maxlength attribute
        if (target.maxLength && target.maxLength > 0 && target.maxLength < 1000000) {
            return target.maxLength;
        }

        // Check for nearby character counter elements
        const parent = target.parentElement;
        if (parent) {
            const counterText = parent.innerText.match(/(\d+)\s*\/\s*(\d+)/);
            if (counterText) {
                return parseInt(counterText[2], 10);
            }
        }

        // Check data attributes
        const dataMax = target.getAttribute('data-max-length') || target.getAttribute('data-maxlength');
        if (dataMax) return parseInt(dataMax, 10);

        return undefined;
    }

    private detectWordLimit(target: HTMLElement, label: string): number | undefined {
        const combinedText = label.toLowerCase();

        // Common patterns: "300 words", "max 500 words", "word limit: 250"
        const wordMatch = combinedText.match(/(\d+)\s*words?/i);
        if (wordMatch) {
            return parseInt(wordMatch[1], 10);
        }

        // Check surrounding elements
        const parent = target.parentElement;
        if (parent) {
            const parentText = parent.innerText.toLowerCase();
            const parentMatch = parentText.match(/(\d+)\s*words?/i);
            if (parentMatch) {
                return parseInt(parentMatch[1], 10);
            }
        }

        return undefined;
    }

    private detectFormat(target: HTMLElement, combinedText: string): 'plain' | 'markdown' | 'html' {
        const text = combinedText.toLowerCase();

        // Advanced Markdown Detection
        const isMarkdownSupported =
            text.includes('markdown') ||
            text.includes('rich text') ||
            text.includes('supports formatting') ||
            text.includes('latex') ||
            target.classList.contains('markdown') ||
            target.getAttribute('data-format') === 'markdown' ||
            // Platform Heuristics
            window.location.hostname.includes('devpost') ||
            window.location.hostname.includes('dorahacks') ||
            window.location.hostname.includes('gitcoin');

        // Explicit Plain Text Detection (Higher Priority if keywords found)
        const isStrictPlain =
            text.includes('plain text only') ||
            text.includes('no formatting') ||
            text.includes('no markdown') ||
            window.location.hostname.includes('docs.google.com/forms');

        if (isStrictPlain) return 'plain';
        if (isMarkdownSupported && target.tagName === 'TEXTAREA') return 'markdown';
        if (target.isContentEditable || target.classList.contains('richtext') || target.classList.contains('wysiwyg')) {
            return 'html';
        }

        return 'plain';
    }

    private getSurroundingContext(target: HTMLElement): string {
        const parts: string[] = [];

        // Get nearby heading
        let el: HTMLElement | null = target;
        for (let i = 0; i < 5 && el; i++) {
            el = el.parentElement;
            if (el) {
                const heading = el.querySelector('h1, h2, h3, h4, h5, h6');
                if (heading) {
                    parts.push(`Section: ${heading.textContent?.trim()}`);
                    break;
                }
            }
        }

        // Get helper text (common patterns)
        const parent = target.parentElement;
        if (parent) {
            const helper = parent.querySelector('.helper-text, .hint, .description, [class*="help"], small');
            if (helper && helper.textContent) {
                parts.push(`Hint: ${helper.textContent.trim().slice(0, 200)}`);
            }
        }

        // Get label's additional info
        const labelEl = document.querySelector(`label[for="${target.id}"]`);
        if (labelEl) {
            const small = labelEl.querySelector('small, span.optional, span.required');
            if (small && small.textContent) {
                parts.push(small.textContent.trim());
            }
        }

        return parts.join(' | ').slice(0, 500);
    }

    private detectPlatform(): string {
        const url = window.location.href.toLowerCase();
        if (url.includes('devpost.com')) return 'DevPost';
        if (url.includes('dorahacks.io')) return 'DoraHacks';
        if (url.includes('mlh.io')) return 'MLH';
        if (url.includes('taikai.network')) return 'Taikai';
        if (url.includes('gitcoin.co')) return 'Gitcoin';
        if (url.includes('immunefi.com')) return 'Immunefi';
        if (url.includes('hackerone.com')) return 'HackerOne';
        if (url.includes('intigriti.com')) return 'Intigriti';
        return 'Default';
    }

    private categorizeFieldEnhanced(label: string, placeholder: string, context: string): FieldCategory {
        const text = (label + ' ' + placeholder + ' ' + context).toLowerCase();

        if (text.includes('elevator') || text.includes('pitch') || text.includes('tagline')) return 'elevator_pitch';
        if (text.includes('description') || text.includes('about') || text.includes('overview')) return 'description';
        if (text.includes('inspiration') || text.includes('why') || text.includes('motivation') || text.includes('what inspired')) return 'inspiration';
        if (text.includes('built') || text.includes('how') || text.includes('technical') || text.includes('architecture') || text.includes('stack')) return 'technical';
        if (text.includes('challenge') || text.includes('obstacle') || text.includes('difficult') || text.includes('learned')) return 'challenges';
        if (text.includes('team') || text.includes('member') || text.includes('collaborat')) return 'team';
        if (text.includes('name') || text.includes('email') || text.includes('phone') || text.includes('linkedin') || text.includes('github')) return 'personal_info';
        if (text.includes('url') || text.includes('link') || text.includes('demo') || text.includes('video') || text.includes('repo')) return 'links';

        return 'generic';
    }

    private async handleSparkleClick() {
        if (!this.activeElement || this.isStreaming) return;

        const target = this.activeElement as HTMLInputElement;

        const storage = getStorage();
        if (!storage) return;

        // CRITICAL FIX: Check for documents in NEW documentStore, not legacy projectContext
        const stored = await storage.get(['userProfile', 'documentStore']);
        const hasProfile = stored.userProfile && Object.keys(stored.userProfile).length > 0;

        // Check new multi-document store
        const documentStore = stored.documentStore as { documents: any[] } | undefined;
        const hasDocument = !!(documentStore?.documents && documentStore.documents.length > 0);

        console.log('[Sparkle] Context check:', {
            hasProfile,
            hasDocument,
            docCount: documentStore?.documents?.length || 0,
            docNames: documentStore?.documents?.map((d: any) => d.filename) || []
        });

        // Enhanced field analysis
        const fieldContext = this.analyzeField(target);

        // Show guidance if missing critical context for project-specific fields
        const needsProjectContext = ['elevator_pitch', 'description', 'inspiration', 'technical', 'challenges'].includes(fieldContext.fieldCategory);

        if (needsProjectContext && !hasDocument && !hasProfile) {
            this.showGuidanceBubble(target, hasProfile, hasDocument, fieldContext.fieldCategory.replace('_', ' '));
            return;
        }

        // Generate with available context
        await this.generateWithEnhancedContext(fieldContext);
    }

    private async generateWithEnhancedContext(fieldContext: FieldContext) {
        if (!this.activeElement) return;

        this.isStreaming = true;
        const target = this.activeElement as HTMLInputElement;

        // Animation: Spin
        const btn = this.sparkleBtn.querySelector('#ss-sparkle-trigger');
        if (btn) {
            btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" style="animation: ss-spin 1s linear infinite;"><circle cx="12" cy="12" r="10" opacity="0.25"/><path d="M12 2C6.48 2 2 6.48 2 12" opacity="0.75"/></svg>`;
        }

        try {
            const result = await generateFieldContentEnhanced(fieldContext);

            const content = result.sparkle_result?.content || result.filled_value || result.template_content;
            const reasoning = result.sparkle_result?.reasoning || result.reasoning || 'Generated based on available context';
            const wasTemplateUsed = !!result.template_content || (content && content.includes('['));

            if (content) {
                // Show enhanced reasoning with tips
                this.showEnhancedReasoning(reasoning, target, fieldContext, wasTemplateUsed);

                // Typewriter effect
                await this.typewriterEffect(target, content);
            }
        } catch (e) {
            console.error("Focus Fill Failed", e);
            // Show error feedback
            this.showEnhancedReasoning(
                "Failed to generate content. Try again or check your connection.",
                target,
                fieldContext,
                false
            );
        } finally {
            this.isStreaming = false;
            const btn = this.sparkleBtn.querySelector('#ss-sparkle-trigger');
            if (btn) {
                btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"></path></svg>`;
            }
        }
    }

    // Legacy method for backward compatibility
    private async generateWithAvailableContext() {
        if (!this.activeElement) return;
        const target = this.activeElement as HTMLInputElement;
        const fieldContext = this.analyzeField(target);

        const storage = getStorage();
        if (!storage) return;

        // FIXED: Check documentStore instead of legacy projectContext
        await storage.get(['userProfile', 'documentStore']);

        await this.generateWithEnhancedContext(fieldContext);
    }

    private getLabel(el: HTMLElement): string {
        return (
            document.querySelector(`label[for="${el.id}"]`)?.textContent?.trim() ||
            el.closest('label')?.textContent?.trim() ||
            el.previousElementSibling?.textContent?.trim() ||
            el.parentElement?.textContent?.trim() ||
            ''
        ).slice(0, 100);
    }

    private async typewriterEffect(element: HTMLInputElement | HTMLTextAreaElement, text: string) {
        element.value = "";
        element.focus();

        const speed = Math.max(10, Math.min(50, 1000 / text.length));

        for (let i = 0; i < text.length; i++) {
            element.value += text.charAt(i);
            element.dispatchEvent(new Event('input', { bubbles: true }));
            if (element.scrollTop !== undefined) element.scrollTop = element.scrollHeight;

            await new Promise(r => setTimeout(r, speed + Math.random() * 10));
        }
        element.dispatchEvent(new Event('change', { bubbles: true }));

        // FIXED: Use outline for success indicator instead of background (dark theme compatible)
        element.style.outline = "2px solid #22c55e";
        element.style.outlineOffset = "1px";
        setTimeout(() => {
            element.style.outline = "";
            element.style.outlineOffset = "";
        }, 2000);
    }
}

/**
 * AppleSanitizer: The "Jony Ive" of text processing
 * Ensures perfect symmetry, typography, and sanitation.
 */
class AppleSanitizer {
    static sanitize(text: string, format: 'plain' | 'markdown' | 'html'): string {
        if (!text) return "";

        let clean = text.trim();

        // 1. Remove AI "Chatter" (prefixes like "Here is your response:")
        clean = clean.replace(/^(here is|sure,|certainly|as requested).*?:/i, "").trim();

        // 2. Wrap up quotes if AI added them
        if (clean.startsWith('"') && clean.endsWith('"')) {
            clean = clean.substring(1, clean.length - 1).trim();
        }

        // 3. Typography: Essential symmetry
        clean = clean.replace(/ {2,}/g, " "); // No double spaces
        clean = clean.replace(/\.{3,}/g, "..."); // Proper ellipses

        // 4. Mode-Specific Sanitation
        if (format === 'plain') {
            // Aggressive Markdown Stripping for Plain Fields
            clean = clean
                .replace(/\*\*(.*?)\*\*/g, "$1") // Bold
                .replace(/\*(.*?)\*/g, "$1")     // Italic
                .replace(/`(.*?)`/g, "$1")       // Code
                .replace(/^#+\s+/gm, "")         // Headers
                .replace(/\[(.*?)\]\(.*?\)/g, "$1") // Links
                .replace(/^- /gm, "• ");         // Prettify list dots for plain text
        }

        return clean.trim();
    }
}

// Initialize Focus Engine
new FocusEngine();

/**
 * Distinguished context resolution Helper - The 'Einstein' Brain
 * Aggregates the Triad Knowledge Base: Profile, Docs, and Instructions
 */
async function resolveDistinguishedContext(fieldContext: FieldContext): Promise<{
    userProfile: any;
    projectContext: string;
    instruction: string;
}> {
    const storage = getStorage();
    if (!storage) throw new Error('Extension context invalidated');

    try {
        const stored = await storage.get([
            'userProfile',
            'documentStore',
            'kbSettings',
            'lastMentionedDocs',
            'lastKbSettings',
            'globalInstructions' // Future-proofing for system-wide prompts
        ]);

        let userProfile = stored.userProfile || {};
        const documentStore = stored.documentStore as { documents: any[] } | undefined;
        const lastMentionedDocs = stored.lastMentionedDocs as { id: string; filename: string }[] | undefined;
        const lastKbSettings = stored.lastKbSettings as { includeProfile: boolean; hasMentionedDocs: boolean } | undefined;

        let projectContext = "";

        // Distinguished logic: Hierarchy of Truth
        // 1. Explicit Mentions from Sidepanel take precedence
        if (lastMentionedDocs && lastMentionedDocs.length > 0 && documentStore?.documents) {
            const mentionedFilenames = new Set(lastMentionedDocs.map(d => d.filename.toLowerCase()));
            const mentionedDocs = documentStore.documents.filter((d: any) =>
                mentionedFilenames.has(d.filename.toLowerCase())
            );

            // CRITICAL: Filter out documents with empty/near-empty content
            const usableDocs = mentionedDocs.filter((d: any) => d.content && d.content.trim().length > 50);
            if (usableDocs.length < mentionedDocs.length) {
                console.warn(`[Sparkle] Filtered out ${mentionedDocs.length - usableDocs.length} empty/near-empty docs from context`);
            }

            if (usableDocs.length > 0) {
                projectContext = usableDocs
                    .map((d: any) => `--- ${d.filename} ---\n${d.content}`)
                    .join('\n\n');
            }

            // Respect the profile toggle from sidepanel
            if (lastKbSettings && !lastKbSettings.includeProfile) {
                userProfile = {};
            }
        }
        // 2. Global KB Settings Fallback
        else if (documentStore?.documents && documentStore.documents.length > 0) {
            const kbSettings = stored.kbSettings as { useProfileAsKnowledge?: boolean; autoProfileWhenNoDocs?: boolean } | undefined;

            // CRITICAL: Only include documents with actual content
            const usableDocs = documentStore.documents.filter((d: any) => d.content && d.content.trim().length > 50);
            if (usableDocs.length > 0) {
                projectContext = usableDocs
                    .map((d: any) => `--- ${d.filename} ---\n${d.content}`)
                    .join('\n\n');
            } else {
                console.warn('[Sparkle] All documents have empty content — no project context available');
            }

            if (kbSettings?.useProfileAsKnowledge === false) {
                userProfile = {};
            }
        }

        // 3. Instruction synthesis (The Socrates part)
        let instruction = `You are a world-class application partner with Einstein-level intelligence and Socratic empathy.
TASK: Draft exceptional, authentic content for the "${fieldContext.fieldCategory.replace('_', ' ')}" field.

DISTINGUISHED GUARDRAILS:
1. GROUNDING: Strictly derive facts from the Project Context. Do NOT hallucinate skills or project features not present in the docs.
2. VERACITY: Use specific terminology from the provided context (e.g., "Confluent Flink", "Vertex AI") rather than generic "AI" buzzwords.
3. CONTEXT AWARENESS: You are currently on ${fieldContext.platformHint}. Adapt your tone to fit this platform's highest standards.
4. SOCTRATIC PRECISION: Answer the *intent* of the question. If the field asks for "Inspiration", connect the user's background to the project's 'Why'.
`;

        if (fieldContext.characterLimit) instruction += `\nCONSTRAINT: Under ${fieldContext.characterLimit} characters. Be concise but profound.\n`;
        if (fieldContext.wordLimit) instruction += `\nCONSTRAINT: Approximately ${fieldContext.wordLimit} words.\n`;

        if (fieldContext.format === 'markdown') {
            instruction += `\nFORMAT: Use sophisticated, magazine-quality Markdown. Bold technical terms for impact. Use whitespace to create an organic, premium feel.\n`;
        } else {
            instruction += `\nFORMAT: STRICT PLAIN TEXT. Zero Markdown symbols. No asterisks, hashes, or backticks. Focus on perfect sentence structure and clean typography.\n`;
        }

        if (fieldContext.surroundingContext) instruction += `\nFIELD-LEVEL CONTEXT: ${fieldContext.surroundingContext}\n`;

        return { userProfile, projectContext, instruction };
    } catch (e) {
        console.error('[Sparkle] Critical context resolution failure:', e);
        throw e;
    }
}

// ========== RESILIENT API WRAPPER (Phase 4.5) ==========
async function hardenedFetch(url: string, options: RequestInit, retryCount = 0): Promise<Response> {
    const storage = getStorage();
    if (!storage) throw new Error('Extension context lost');

    // 1. Ensure we have the latest token before the first attempt if it's a retry
    if (retryCount > 0) {
        try {
            const refreshResponse = await chrome.runtime.sendMessage({ type: 'REFRESH_TOKEN' });
            if (refreshResponse && refreshResponse.token) {
                options.headers = {
                    ...options.headers,
                    'Authorization': `Bearer ${refreshResponse.token}`
                };
                console.log(`🔄 [EXT] Token refreshed for retry ${retryCount}`);
            }
        } catch (e) {
            console.warn('[EXT] Token refresh failed during retry', e);
        }
    }

    // Use proxiedFetch if in content script context, otherwise fetch
    const response = await proxiedFetch(url, options);

    // 2. Handle 401 Unauthorized with a single retry
    if (response.status === 401 && retryCount < 1) {
        console.warn('⚠️ [EXT] 401 Unauthorized detected. Attempting token refresh...');
        return await hardenedFetch(url, options, retryCount + 1);
    }

    return response;
}

// ========== ENHANCED API HELPER (Phase 4) ==========
async function generateFieldContentEnhanced(
    fieldContext: FieldContext
) {
    const storage = getStorage();
    if (!storage) throw new Error('Extension context invalidated');

    const { userProfile, projectContext, instruction } = await resolveDistinguishedContext(fieldContext);

    // CRITICAL: Request token refresh from extension before API call
    let storedToken = (await storage.get(['authToken'])).authToken;
    try {
        const refreshResponse = await chrome.runtime.sendMessage({ type: 'REFRESH_TOKEN' });
        if (refreshResponse && refreshResponse.token) {
            storedToken = refreshResponse.token;
            console.log('🔄 [Sparkle] Token refreshed pre-generation');
        }
    } catch (msgErr) {
        console.warn('⚠️ [Sparkle] Could not proactively refresh token', msgErr);
    }

    if (!storedToken) throw new Error('Not authenticated');

    const response = await hardenedFetch(ENDPOINTS.mapFields, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${storedToken}`
        },
        body: JSON.stringify({
            form_fields: [],
            user_profile: userProfile,
            target_field: { ...fieldContext },
            project_context: projectContext,
            instruction
        })
    });

    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const data = await response.json();

    // Jaw-dropping sanitation before it hits the typewriter
    if (data.sparkle_result && data.sparkle_result.content) {
        data.sparkle_result.content = AppleSanitizer.sanitize(
            data.sparkle_result.content,
            fieldContext.format as any
        );
    }

    return data;
}

// Global scope helpers
const safeSendMessage = async (message: any) => {
    if (!isExtensionValid()) return;
    try {
        return await chrome.runtime.sendMessage(message);
    } catch (e) { }
};

function uniqueSelector(el: Element): string {
    if (el.id) return `#${el.id}`;
    if ((el as any).name) return `[name="${(el as any).name}"]`;
    return el.tagName.toLowerCase();
}

// Listeners
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!isExtensionValid()) return;
    if (message.type === 'GET_PAGE_CONTEXT') {
        sendResponse(getPageContext());
    } else if (message.type === 'AUTO_FILL_REQUEST') {
        handleAutoFill(message.projectContext).then(sendResponse);
        return true;
    }
});

async function handleAutoFill(projectContext?: string) {
    const allInputs: HTMLElement[] = [];
    document.querySelectorAll('input, select, textarea').forEach(el => allInputs.push(el as HTMLElement));
    document.querySelectorAll('[contenteditable="true"]').forEach(el => allInputs.push(el as HTMLElement));

    const formFields = allInputs.map((el: any) => ({
        id: el.id || '',
        name: el.name || '',
        type: el.type || el.tagName.toLowerCase(),
        placeholder: el.placeholder || '',
        label: (el.labels?.[0]?.textContent || el.placeholder || el.name || '').slice(0, 100),
        selector: uniqueSelector(el)
    })).filter(f => !['hidden', 'submit', 'button', 'file'].includes(f.type));

    const storage = getStorage();
    if (!storage) return { success: false, error: "Context lost" };

    try {
        const stored = await storage.get(['userProfile', 'authToken']);
        if (!stored.authToken) return { success: false, error: "Not authenticated" };

        const response = await hardenedFetch(ENDPOINTS.mapFields, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${stored.authToken}`
            },
            body: JSON.stringify({
                form_fields: formFields,
                user_profile: stored.userProfile || {},
                project_context: projectContext
            })
        });

        const data = await response.json();
        const mappings = data.field_mappings || {};

        for (const [selector, value] of Object.entries(mappings)) {
            try {
                const el = document.querySelector(selector) as HTMLInputElement;
                if (el && value) {
                    el.value = String(value);
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                }
            } catch (e) { }
        }
        return { success: true };
    } catch (error) {
        return { success: false, error: String(error) };
    }
}

// Initialization icon (restricted to scholarship pages)
if (document.body.innerText.match(/scholarship|hackathon|grant|devpost|dorahacks/i)) {
    const icon = document.createElement('div');
    icon.id = 'scholarstream-pulse-icon';
    icon.style.cssText = `position:fixed;bottom:20px;right:20px;width:60px;height:60px;z-index:9999;cursor:pointer;`;
    const img = document.createElement('img');
    img.src = isExtensionValid() ? chrome.runtime.getURL("assets/ss_logo.png") : "";
    img.style.cssText = "width:100%;height:100%;border-radius:50%;";
    icon.appendChild(img);
    icon.onclick = () => safeSendMessage({ type: 'OPEN_SIDE_PANEL' });
    document.body.appendChild(icon);
}

