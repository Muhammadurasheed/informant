// ========== INFORMANT CONTENT SCRIPT ==========
// Self-contained for content script stability (no ESM imports)

/**
 * Informant Content Script
 *
 * Responsibilities:
 * 1. Page context — send current URL/title to side panel when asked
 * 2. Sparkle engine — floating AI button on form fields for auto-fill
 * 3. Fill fields — receive fill commands from side panel and apply them
 * 4. Recording badge — show/hide the "🔴 INFORMANT RECORDING" badge (Scene 2)
 *
 * NOTE: DOM text scraping has been REMOVED. Informant uses VideoDB visual
 * memory (indexed screen captures) as its knowledge source — not DOM text.
 */

// NOTE: Content script cannot import from config.ts (no ESM).
// This must match VITE_API_URL / the running backend port.
// For production deploy, rebuild with the correct URL.
const API_URL = 'http://localhost:8081';
const ENDPOINTS = {
    chat:           `${API_URL}/api/extension/chat`,
    mapFields:      `${API_URL}/api/extension/map-fields`,
    userProfile:    `${API_URL}/api/extension/user-profile`,
    parseDocument:  `${API_URL}/api/extension/documents/parse`,
};

console.log('[Informant] Content script loaded →', window.location.href);

// ========== Storage Helpers ==========

function isExtensionValid(): boolean {
    return typeof chrome !== 'undefined' && !!chrome.runtime && !!chrome.runtime.id;
}

function getStorage() {
    if (!isExtensionValid()) return null;
    if (typeof chrome === 'undefined' || !chrome.storage?.local) return null;
    return chrome.storage.local;
}

async function proxiedFetch(url: string, options: any = {}): Promise<any> {
    if (!isExtensionValid()) throw new Error('Extension context lost. Please refresh the page.');

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
                if (!response?.success) {
                    reject(new Error(response?.error || 'Request failed'));
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

// ========== Page Context (minimal — URL + title only) ==========

function getPageContext() {
    return {
        title: document.title,
        url: window.location.href,
        // NOTE: We intentionally do NOT scrape DOM text here.
        // Informant's knowledge comes from VideoDB visual memory (indexed screen captures).
        forms: Array.from(document.querySelectorAll('input, textarea, select'))
            .map((el, index) => {
                const element = el as HTMLInputElement;
                const rect = element.getBoundingClientRect();
                if (rect.width === 0 || rect.height === 0 || element.type === 'hidden') return null;
                return {
                    id: element.id || `field_${index}`,
                    name: element.name || '',
                    type: element.type || 'text',
                    placeholder: (element as any).placeholder || '',
                    label: getLabelForField(element),
                    selector: element.id ? `#${element.id}` : `[name="${element.name}"]`
                };
            })
            .filter(Boolean)
    };
}

function getLabelForField(el: HTMLElement): string {
    // Try aria-label
    const aria = el.getAttribute('aria-label');
    if (aria) return aria;

    // Try associated <label>
    const id = el.id;
    if (id) {
        const label = document.querySelector(`label[for="${id}"]`);
        if (label) return label.textContent?.trim() || '';
    }

    // Try parent label
    const parentLabel = el.closest('label');
    if (parentLabel) return parentLabel.textContent?.trim() || '';

    // Try placeholder
    return (el as HTMLInputElement).placeholder || el.getAttribute('name') || '';
}


// ========== Recording Badge (Scene 2: 🔴 INFORMANT RECORDING) ==========

let recordingBadge: HTMLDivElement | null = null;
let hudState: 'recording' | 'uploading' | 'indexing' | 'ready' | 'failed' = 'recording';
let memoryCount = 0;
let hudErrorMessage = '';

function updateHudBadge() {
    if (!recordingBadge) return;

    const pulseDot = recordingBadge.querySelector('#informant-hud-dot') as HTMLDivElement;
    const mainText = recordingBadge.querySelector('#informant-hud-text') as HTMLSpanElement;
    const pill = recordingBadge.querySelector('#informant-hud-pill') as HTMLSpanElement;
    const hint = recordingBadge.querySelector('#informant-hud-hint') as HTMLDivElement;

    if (!pulseDot || !mainText || !pill) return;

    if (hudState === 'recording') {
        recordingBadge.style.borderColor = '#ef4444';
        recordingBadge.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 0 20px rgba(239, 68, 68, 0.3)';
        pulseDot.style.background = '#ef4444';
        pulseDot.style.boxShadow = '0 0 15px #ef4444';
        pulseDot.style.animation = 'informant-pulse 1.5s infinite';
        mainText.textContent = '🔴 INFORMANT LIVE';
        pill.textContent = `📸 ${memoryCount} Memories`;
        pill.style.background = 'rgba(239, 68, 68, 0.2)';
        pill.style.color = '#fca5a5';
        if (hint) hint.style.display = 'block';
    } else if (hudState === 'uploading' || hudState === 'indexing') {
        recordingBadge.style.borderColor = '#6366f1';
        recordingBadge.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 0 20px rgba(99, 102, 241, 0.3)';
        pulseDot.style.background = '#8b5cf6';
        pulseDot.style.boxShadow = '0 0 15px #8b5cf6';
        pulseDot.style.animation = 'informant-spin 1s linear infinite';
        mainText.textContent = hudState === 'uploading' ? '🔄 Uploading memory...' : '⚡ VideoDB Indexing...';
        pill.textContent = 'Processing';
        pill.style.background = 'rgba(99, 102, 241, 0.2)';
        pill.style.color = '#c7d2fe';
        if (hint) hint.style.display = 'none';
    } else if (hudState === 'ready') {
        recordingBadge.style.borderColor = '#10b981';
        recordingBadge.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 0 20px rgba(16, 185, 129, 0.3)';
        pulseDot.style.background = '#10b981';
        pulseDot.style.boxShadow = '0 0 15px #10b981';
        pulseDot.style.animation = 'none';
        mainText.textContent = '✅ Memory Ready!';
        pill.textContent = 'Co-Pilot Updated';
        pill.style.background = 'rgba(16, 185, 129, 0.2)';
        pill.style.color = '#6ee7b7';
        if (hint) hint.style.display = 'none';
        setTimeout(() => hideRecordingBadge(), 6000);
    } else if (hudState === 'failed') {
        recordingBadge.style.borderColor = '#f43f5e';
        recordingBadge.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 0 20px rgba(244, 63, 94, 0.3)';
        pulseDot.style.background = '#f43f5e';
        pulseDot.style.boxShadow = '0 0 15px #f43f5e';
        pulseDot.style.animation = 'none';
        mainText.textContent = `❌ Indexing Error`;
        pill.textContent = hudErrorMessage || 'Failed';
        pill.style.background = 'rgba(244, 63, 94, 0.2)';
        pill.style.color = '#fda4af';
        if (hint) hint.style.display = 'none';
        setTimeout(() => hideRecordingBadge(), 8000);
    }
}

function showRecordingBadge() {
    if (recordingBadge && document.body.contains(recordingBadge)) {
        updateHudBadge();
        return;
    }

    if (!document.getElementById('informant-pulse-style')) {
        const style = document.createElement('style');
        style.id = 'informant-pulse-style';
        style.textContent = `
            @keyframes informant-pulse {
                0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
                70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
                100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
            }
            @keyframes informant-spin { to { transform: rotate(360deg); } }
            @keyframes informant-fadein {
                from { opacity: 0; transform: translateY(-10px); scale: 0.95; }
                to { opacity: 1; transform: translateY(0); scale: 1; }
            }
        `;
        document.head.appendChild(style);
    }

    recordingBadge = document.createElement('div');
    recordingBadge.id = 'informant-recording-badge';
    recordingBadge.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 2147483647;
        background: rgba(15, 15, 25, 0.95);
        border: 2px solid #ef4444;
        border-radius: 16px;
        padding: 12px 20px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        font-family: 'Inter', system-ui, -apple-system, sans-serif;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 0 20px rgba(239, 68, 68, 0.3);
        animation: informant-fadein 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        backdrop-filter: blur(16px);
        user-select: none;
        pointer-events: auto;
        cursor: move;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    `;

    recordingBadge.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
            <div id="informant-hud-dot" style="
                width: 10px; height: 10px;
                background: #ef4444;
                border-radius: 50%;
                box-shadow: 0 0 15px #ef4444;
                animation: informant-pulse 1.5s infinite;
            "></div>
            <span id="informant-hud-text" style="font-size: 13px; font-weight: 800; color: #ffffff; letter-spacing: 0.05em; text-shadow: 0 2px 4px rgba(0,0,0,0.5);">🔴 INFORMANT LIVE</span>
            <span id="informant-hud-pill" style="
                font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 9999px;
                background: rgba(239, 68, 68, 0.2); color: #fca5a5; border: 1px solid rgba(255,255,255,0.1);
            ">📸 ${memoryCount} Memories</span>
        </div>
        <div id="informant-hud-hint" style="font-size: 9px; color: #94a3b8; font-weight: 600; text-align: right; margin-top: -2px;">
            Stop: Ctrl+Shift+X
        </div>
    `;

    // Make HUD draggable so it never blocks the user's view
    let isDragging = false;
    let dragOffset = { x: 0, y: 0 };
    recordingBadge.onmousedown = (e) => {
        isDragging = true;
        const rect = recordingBadge!.getBoundingClientRect();
        dragOffset = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    document.addEventListener('mousemove', (e) => {
        if (!isDragging || !recordingBadge) return;
        recordingBadge.style.left = `${e.clientX - dragOffset.x}px`;
        recordingBadge.style.top = `${e.clientY - dragOffset.y}px`;
        recordingBadge.style.right = 'auto';
    });
    document.addEventListener('mouseup', () => { isDragging = false; });

    document.body.appendChild(recordingBadge);
    updateHudBadge();
}

function hideRecordingBadge() {
    if (recordingBadge) {
        recordingBadge.remove();
        recordingBadge = null;
    }
}


// ========== Sparkle Engine — AI Field Auto-Fill ==========

interface FieldContext {
    id: string;
    name: string;
    label: string;
    placeholder: string;
    type: string;
    selector: string;
    characterLimit?: number;
    wordLimit?: number;
    format: 'plain' | 'markdown';
    isRequired: boolean;
    surroundingContext: string;
    fieldCategory: string;
    pageTitle: string;
    pageUrl: string;
}

class SparkleEngine {
    private activeElement: HTMLElement | null = null;
    private sparkleBtn: HTMLDivElement;
    private isDragging = false;
    private dragOffset = { x: 0, y: 0 };
    private hidden = false;

    constructor() {
        this.sparkleBtn = this.createSparkleButton();
        this.initListeners();
    }

    private createSparkleButton(): HTMLDivElement {
        // Inject animation styles
        const style = document.createElement('style');
        style.textContent = `
            @keyframes informant-sparkle-pulse {
                0% { box-shadow: 0 0 0 0 rgba(139, 92, 246, 0.7); }
                70% { box-shadow: 0 0 0 8px rgba(139, 92, 246, 0); }
                100% { box-shadow: 0 0 0 0 rgba(139, 92, 246, 0); }
            }
            @keyframes informant-spin { to { transform: rotate(360deg); } }
            #informant-sparkle-container.dragging { cursor: grabbing !important; }
        `;
        document.head.appendChild(style);

        const container = document.createElement('div');
        container.id = 'informant-sparkle-container';
        container.style.cssText = `
            position: absolute;
            display: none;
            z-index: 2147483647;
            cursor: grab;
        `;

        const btn = document.createElement('div');
        btn.id = 'informant-sparkle-btn';
        btn.title = '✨ Fill with Informant';
        btn.style.cssText = `
            width: 32px; height: 32px;
            background: linear-gradient(135deg, #8b5cf6, #6366f1);
            border-radius: 50%;
            cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.25);
            transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
            animation: informant-sparkle-pulse 2s infinite;
        `;
        btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg>`;

        const closeBtn = document.createElement('div');
        closeBtn.style.cssText = `
            position: absolute; top: -6px; right: -6px;
            width: 16px; height: 16px;
            background: #ef4444; border-radius: 50%;
            cursor: pointer; display: flex; align-items: center; justify-content: center;
            font-size: 11px; font-weight: bold; color: white;
            opacity: 0; transition: opacity 0.2s;
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

        // Drag support
        container.onmousedown = (e) => {
            if ((e.target as HTMLElement) === closeBtn) return;
            this.isDragging = true;
            container.classList.add('dragging');
            const rect = container.getBoundingClientRect();
            this.dragOffset = { x: e.clientX - rect.left, y: e.clientY - rect.top };
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

        btn.onclick = (e) => {
            if (this.isDragging) return;
            e.preventDefault(); e.stopPropagation();
            this.handleSparkleClick();
        };
        closeBtn.onclick = (e) => {
            e.preventDefault(); e.stopPropagation();
            this.hidden = true;
            this.hide();
        };

        document.body.appendChild(container);
        return container as HTMLDivElement;
    }

    private initListeners() {
        document.addEventListener('focusin', (e) => this.handleFocus(e), true);
        document.addEventListener('scroll', () => this.updatePosition(), true);
        window.addEventListener('resize', () => this.updatePosition());
    }

    private handleFocus(e: FocusEvent) {
        const target = e.target as HTMLElement;
        if (!target) return;

        const tag = target.tagName;
        if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) && !target.isContentEditable) {
            this.hide();
            return;
        }

        const input = target as HTMLInputElement;
        if (['file', 'hidden', 'submit', 'image', 'button', 'checkbox', 'radio'].includes(input.type)) {
            this.hide();
            return;
        }

        this.activeElement = target;
        this.hidden = false;
        this.show(target);
    }

    private show(target: HTMLElement) {
        if (this.hidden) return;
        const rect = target.getBoundingClientRect();
        const top = rect.top + window.scrollY + (rect.height / 2) - 16;
        const left = rect.right + window.scrollX - 40;
        this.sparkleBtn.style.top = `${top}px`;
        this.sparkleBtn.style.left = `${left}px`;
        this.sparkleBtn.style.display = 'flex';
    }

    private hide() {
        this.sparkleBtn.style.display = 'none';
    }

    private updatePosition() {
        if (this.activeElement && this.sparkleBtn.style.display !== 'none') {
            this.show(this.activeElement);
        }
    }

    private analyzeField(el: HTMLElement): FieldContext {
        const input = el as HTMLInputElement;
        const label = getLabelForField(el);
        const maxLength = input.maxLength > 0 ? input.maxLength : undefined;

        return {
            id: input.id || '',
            name: input.name || '',
            label,
            placeholder: input.placeholder || '',
            type: input.type || 'text',
            selector: input.id ? `#${input.id}` : `[name="${input.name}"]`,
            characterLimit: maxLength,
            wordLimit: undefined,
            format: 'plain',
            isRequired: input.required,
            surroundingContext: (el.closest('form, section, div[class*="field"], div[class*="form"]') as HTMLElement)?.innerText?.slice(0, 200) || '',
            fieldCategory: this.categorizeField(label, input.name, input.placeholder),
            pageTitle: document.title,
            pageUrl: window.location.href
        };
    }

    private categorizeField(label: string, name: string, placeholder: string): string {
        const text = `${label} ${name} ${placeholder}`.toLowerCase();
        if (/pitch|summary|about|description|overview/.test(text)) return 'description';
        if (/inspire|why|motivat/.test(text)) return 'inspiration';
        if (/technical|stack|tech|built/.test(text)) return 'technical';
        if (/challenge|difficult|problem/.test(text)) return 'challenges';
        if (/name|first|last/.test(text)) return 'personal_info';
        if (/link|url|github|linkedin|portfolio/.test(text)) return 'links';
        return 'generic';
    }

    private async handleSparkleClick() {
        if (!this.activeElement) return;

        const fieldContext = this.analyzeField(this.activeElement);
        const input = this.activeElement as HTMLInputElement;

        // Show loading state on the button
        const btn = this.sparkleBtn.querySelector('#informant-sparkle-btn') as HTMLElement;
        if (btn) {
            btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" style="animation: informant-spin 1s linear infinite"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>`;
            btn.style.animation = 'none';
        }

        try {
            const storage = getStorage();
            if (!storage) throw new Error('Extension context lost');

            const stored = await new Promise<any>((resolve) =>
                storage.get(['authToken', 'userProfile', 'documentStore', 'uploadedDocs'], resolve)
            );

            const authToken = stored.authToken;
            if (!authToken) throw new Error('Not signed in');

            // Build project context from active uploaded documents
            const allDocs = stored.uploadedDocs || (stored.documentStore?.documents ? stored.documentStore.documents.map((d:any) => ({ id: d.id, name: d.filename, content: d.content })) : []);
            const activeDocs = allDocs.filter((d: any) => d.activeForAutofill !== false);

            const projectContext = activeDocs.length > 0
                ? activeDocs.map((d: any) => `--- [Active Knowledge Document: ${d.name || d.filename}] ---\n${d.content}`).join('\n\n')
                : null;

            const userProfile = stored.userProfile || {};

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
                        pageUrl: window.location.href
                    },
                    project_context: projectContext,
                    instruction: null
                })
            });

            if (!response.ok) throw new Error('Sparkle generation failed');

            const data = await response.json();
            const content = data.sparkle_result?.content || '';

            if (content) {
                await this.typewriterFill(input, content);
            }

        } catch (error) {
            console.error('[Informant Sparkle] Error:', error);
            // Flash red on error
            if (btn) btn.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
            setTimeout(() => {
                if (btn) btn.style.background = 'linear-gradient(135deg, #8b5cf6, #6366f1)';
            }, 2000);
        } finally {
            // Restore button
            if (btn) {
                btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg>`;
                btn.style.animation = 'informant-sparkle-pulse 2s infinite';
            }
        }
    }

    private async typewriterFill(input: HTMLInputElement | HTMLTextAreaElement, content: string) {
        input.focus();
        input.value = '';

        for (let i = 0; i <= content.length; i++) {
            input.value = content.slice(0, i);
            input.dispatchEvent(new Event('input', { bubbles: true }));
            await new Promise(r => setTimeout(r, 8));
        }

        // Trigger React/Vue/Angular change detection
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new Event('blur', { bubbles: true }));
        input.dispatchEvent(new Event('focus', { bubbles: true }));
    }
}

// Init sparkle engine
new SparkleEngine();

// Proactive status check on load (Scene 2: Persistence)
if (isExtensionValid()) {
    chrome.runtime.sendMessage({ type: 'CHECK_RECORDING_STATUS' }, (response) => {
        if (response?.isCapturing) {
            hudState = 'recording';
            showRecordingBadge();
        }
    });
}

// ========== Message Handler ==========

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    switch (message.type) {

        case 'GET_PAGE_CONTEXT':
            sendResponse(getPageContext());
            break;

        case 'FILL_FIELD': {
            const el = document.querySelector(message.selector) as HTMLInputElement;
            if (el) {
                el.focus();
                el.value = message.value;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
                sendResponse({ success: true });
            } else {
                sendResponse({ success: false, error: `Field not found: ${message.selector}` });
            }
            break;
        }

        case 'SHOW_RECORDING_BADGE':
            hudState = 'recording';
            showRecordingBadge();
            sendResponse({ success: true });
            break;

        case 'HIDE_RECORDING_BADGE':
            hideRecordingBadge();
            sendResponse({ success: true });
            break;

        case 'CHUNK_ACQUIRED_UI':
            memoryCount = message.chunkIndex || (memoryCount + 1);
            if (hudState === 'recording') updateHudBadge();
            sendResponse({ success: true });
            break;

        case 'INDEXING_STARTED':
            hudState = message.phase === 'uploading' ? 'uploading' : 'indexing';
            showRecordingBadge();
            updateHudBadge();
            sendResponse({ success: true });
            break;

        case 'INDEXING_COMPLETE':
            hudState = 'ready';
            showRecordingBadge();
            updateHudBadge();
            sendResponse({ success: true });
            break;

        case 'INDEXING_FAILED':
            hudState = 'failed';
            hudErrorMessage = message.detail || message.reason || 'Error';
            showRecordingBadge();
            updateHudBadge();
            sendResponse({ success: true });
            break;

        case 'AUTO_FILL_REQUEST': {
            // Batch fill all detected form fields
            const storage = getStorage();
            if (!storage) { sendResponse({ success: false, error: 'Extension context lost' }); break; }

            storage.get(['authToken', 'userProfile', 'documentStore'], async (stored) => {
                const authToken = stored.authToken;
                if (!authToken) { sendResponse({ success: false, error: 'Not signed in' }); return; }

                const context = getPageContext();
                const fields = context.forms;
                if (!fields.length) { sendResponse({ success: false, message: 'No form fields detected' }); return; }

                const docStore = stored.documentStore;
                const projectContext = docStore?.documents?.length > 0
                    ? docStore.documents.map((d: any) => `--- ${d.filename} ---\n${d.content}`).join('\n\n')
                    : message.projectContext || null;

                try {
                    const response = await proxiedFetch(ENDPOINTS.mapFields, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${authToken}`
                        },
                        body: JSON.stringify({
                            form_fields: fields,
                            user_profile: stored.userProfile || {},
                            project_context: projectContext
                        })
                    });

                    const data = await response.json();
                    const mappings: Record<string, string> = data.field_mappings || {};
                    let filled = 0;

                    for (const [selector, value] of Object.entries(mappings)) {
                        const el = document.querySelector(selector) as HTMLInputElement;
                        if (el && value) {
                            el.value = value as string;
                            el.dispatchEvent(new Event('input', { bubbles: true }));
                            el.dispatchEvent(new Event('change', { bubbles: true }));
                            filled++;
                        }
                    }

                    sendResponse({ success: true, filled });
                } catch (err) {
                    sendResponse({ success: false, error: err instanceof Error ? err.message : 'Failed' });
                }
            });
            return true; // Keep channel open for async
        }
    }
    return true;
});
