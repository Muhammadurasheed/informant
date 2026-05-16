import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, User, Bot, Mic, MicOff, FileText, LogIn, CheckCircle2, Circle, Globe, X, Loader2, RefreshCw, Plus, ChevronDown, ChevronUp, ToggleLeft, ToggleRight } from 'lucide-react';

import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../utils/firebase';
import { ENDPOINTS, detectPlatform, calculateProfileCompleteness, parseDocument, generateDocumentId, getStorage, type ContextStatus, type UploadedDocument } from '../config';
import { MarkdownMessage } from './MarkdownMessage';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    text: string;
}

// Multi-document support
interface DocumentStore {
    documents: UploadedDocument[];
    activeDocIds: string[]; // Selected via @ mention
}

// Knowledge base settings
interface KnowledgeBaseSettings {
    useProfileAsKnowledge: boolean;  // Toggle for profile inclusion
    autoProfileWhenNoDocs: boolean;  // Auto-include profile when no docs mentioned
}

export default function App() {
    const [messages, setMessages] = useState<Message[]>([
        { id: '1', role: 'assistant', text: 'Hello! I am Informant, your AI Browser Co-Pilot. I have eyes and ears to help you with anything you see on this page.\n\n**Tips to get started:**\n- Ask about details on this page\n- Upload documents for deep context\n- Use **@docname** to reference specific docs\n- Click the ✨ sparkle on any field for AI assistance' }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [isListening, setIsListening] = useState(false);

    // Multi-document state
    const [documentStore, setDocumentStore] = useState<DocumentStore>({ documents: [], activeDocIds: [] });
    const [mentionFilter, setMentionFilter] = useState('');

    // Knowledge base settings - FAANG-level control
    const [kbSettings, setKbSettings] = useState<KnowledgeBaseSettings>({
        useProfileAsKnowledge: true,  // Default: include profile
        autoProfileWhenNoDocs: true,  // Auto-include when no docs mentioned
    });

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const [showMentionDropdown, setShowMentionDropdown] = useState(false);
    const [mentionCursorPos, setMentionCursorPos] = useState(0);

    const [authToken, setAuthToken] = useState<string | null>(null);
    const [userProfile, setUserProfile] = useState<any>(null);

    // Context Status (Enhanced for Phase 2)
    const [contextStatus, setContextStatus] = useState<ContextStatus>({
        profileCompleteness: 0,
        hasDocument: false,
        documentName: null,
        documentCharCount: 0,
        platform: 'Unknown',
        pageUrl: '',
        isProcessing: false,
        processingError: null,
    });
    const [isRecording, setIsRecording] = useState(false);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const [showContextPanel, setShowContextPanel] = useState(true);
    const [isSyncingProfile, setIsSyncingProfile] = useState(false);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages]);

    // Check for existing token, profile, documents, and KB settings on mount
    useEffect(() => {
        const storage = getStorage();
        if (!storage) return;

        storage.get(['authToken', 'userProfile', 'documentStore', 'kbSettings'], (result) => {
            if (result.authToken) {
                setAuthToken(result.authToken);
            }
            if (result.userProfile) {
                setUserProfile(result.userProfile);
                setContextStatus(prev => ({
                    ...prev,
                    profileCompleteness: calculateProfileCompleteness(result.userProfile)
                }));
            }
            // Load multi-document store
            if (result.documentStore) {
                const store = result.documentStore as DocumentStore;
                setDocumentStore(store);
                const totalChars = store.documents.reduce((sum, d) => sum + d.charCount, 0);
                setContextStatus(prev => ({
                    ...prev,
                    hasDocument: store.documents.length > 0,
                    documentName: store.documents.length > 0 ? `${store.documents.length} docs` : null,
                    documentCharCount: totalChars,
                }));
            }
            // Load KB settings
            if (result.kbSettings) {
                setKbSettings(result.kbSettings as KnowledgeBaseSettings);
            }
        });

        // Listen for storage changes
        const listener = (changes: any, area: string) => {
            if (area === 'local') {
                if (changes.authToken) {
                    setAuthToken(changes.authToken.newValue);
                }
                if (changes.userProfile) {
                    setUserProfile(changes.userProfile.newValue);
                    setContextStatus(prev => ({
                        ...prev,
                        profileCompleteness: calculateProfileCompleteness(changes.userProfile.newValue)
                    }));
                }
            }
        };

        if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.onChanged.addListener(listener);
            return () => chrome.storage.onChanged.removeListener(listener);
        }
    }, []);

    // NEW: FAANG-grade Token Heartbeat & Zero-Touch Sync
    // Continuously check for token if we don't have one (Zero-Touch optimization)
    useEffect(() => {
        if (authToken) return;

        const checkToken = () => {
            const storage = getStorage();
            if (!storage) return;

            storage.get(['authToken'], (result) => {
                if (result.authToken && result.authToken !== authToken) {
                    console.log('✨ [EXT] Zero-Touch: Auth token detected via heartbeat');
                    setAuthToken(result.authToken);
                }
            });
        };

        const interval = setInterval(checkToken, 2000); // 2s heartbeat for instant unlock
        return () => clearInterval(interval);
    }, [authToken]);

    // Unified Token Refresh Helper
    const refreshAuthToken = async (force = true) => {
        try {
            const currentUser = auth.currentUser;
            if (currentUser) {
                const token = await currentUser.getIdToken(force);
                setAuthToken(token);
                const storage = getStorage();
                if (storage) await storage.set({ authToken: token });
                console.log(`🔄 [EXT] Auth token refreshed (force=${force})`);
                return token;
            }
        } catch (err) {
            console.warn("⚠️ [EXT] Token refresh failed:", err);
        }
        return authToken;
    };

    // Listen for refresh requests from content script
    useEffect(() => {
        const messageListener = (message: any, _sender: any, sendResponse: any) => {
            if (message.type === 'REFRESH_TOKEN') {
                refreshAuthToken(true).then(token => sendResponse({ token }));
                return true; // Keep channel open for async response
            }
        };
        chrome.runtime.onMessage.addListener(messageListener);
        return () => chrome.runtime.onMessage.removeListener(messageListener);
    }, [authToken]);

    // FAANG-grade Token Refresh Logic
    useEffect(() => {
        const unsubscribe = auth.onIdTokenChanged(async (user: any) => {
            if (user) {
                await refreshAuthToken(false); // Background refresh (no force)
            }
        });
        return () => unsubscribe();
    }, []);

    // Detect platform when tab changes
    useEffect(() => {
        const updatePlatform = async () => {
            try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (tab?.url) {
                    setContextStatus(prev => ({
                        ...prev,
                        platform: detectPlatform(tab.url || ''),
                        pageUrl: tab.url || ''
                    }));
                }
            } catch (e) {
                console.warn("Could not detect platform:", e);
            }
        };
        updatePlatform();

        // Listen for tab changes
        chrome.tabs.onActivated?.addListener(updatePlatform);
        chrome.tabs.onUpdated?.addListener((_, changeInfo) => {
            if (changeInfo.url) updatePlatform();
        });
    }, []);

    // Sync profile from Firebase
    const syncProfile = async () => {
        if (!authToken) return;
        setIsSyncingProfile(true);

        try {
            const user = auth.currentUser;
            if (user) {
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                if (userDoc.exists()) {
                    const profileData = userDoc.data();
                    const storage = getStorage();
                    if (storage) await storage.set({ userProfile: profileData });
                    setUserProfile(profileData);
                    setContextStatus(prev => ({
                        ...prev,
                        profileCompleteness: calculateProfileCompleteness(profileData)
                    }));
                    setMessages(prev => [...prev, {
                        id: Date.now().toString(),
                        role: 'assistant',
                        text: `✅ Profile synced! Completeness: ${calculateProfileCompleteness(profileData)}%`
                    }]);
                }
            }
        } catch (error) {
            console.error("Profile sync failed:", error);
        } finally {
            setIsSyncingProfile(false);
        }
    };



    // Voice Handler (Web Speech API)
    const toggleVoice = () => {
        if (isListening) {
            return;
        }

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("Voice input is not supported in this browser.");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => setIsListening(true);

        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            setInput(prev => prev + (prev ? ' ' : '') + transcript);
        };

        recognition.onend = () => setIsListening(false);
        recognition.onerror = (event: any) => {
            console.error("Speech error", event.error);
            setIsListening(false);
        };

        recognition.start();
    };

    // Enhanced File Upload Handler - Multi-document support
    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setContextStatus(prev => ({ ...prev, isProcessing: true, processingError: null }));

        const filename = file.name.toLowerCase();
        const needsBackendParsing = filename.endsWith('.pdf') || filename.endsWith('.docx');

        let content = '';
        let charCount = 0;
        let fileType = 'text';

        if (needsBackendParsing && authToken) {
            // CRITICAL: Force-refresh the Firebase token before API call
            const freshToken = await refreshAuthToken(true);

            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'assistant',
                text: `📄 Processing **${file.name}**... Extracting text content.`
            }]);

            const result = await parseDocument(file, freshToken);
            if (!result.success) {
                setContextStatus(prev => ({ ...prev, isProcessing: false, processingError: result.error || 'Failed' }));
                setMessages(prev => [...prev, {
                    id: Date.now().toString(),
                    role: 'assistant',
                    text: `❌ Failed to parse "${file.name}": ${result.error}`
                }]);
                return;
            }

            // CRITICAL: Validate that parsing actually extracted usable content
            // Prevents storing 0-char documents that starve the copilot of context
            if (!result.content || result.charCount < 10) {
                setContextStatus(prev => ({ ...prev, isProcessing: false, processingError: 'No text extracted' }));
                setMessages(prev => [...prev, {
                    id: Date.now().toString(),
                    role: 'assistant',
                    text: `⚠️ Could not extract readable text from **${file.name}**.\n\nThis may be a scanned or image-based document. Try:\n- A text-based PDF (not scanned)\n- Copy-pasting the content into a **.txt** file\n- A **.docx** version of the document`
                }]);
                return;
            }

            content = result.content;
            charCount = result.charCount;
            fileType = result.fileType;
        } else {
            // Simple text reading
            content = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target?.result as string);
                reader.onerror = reject;
                reader.readAsText(file);
            });
            charCount = content.length;
        }

        // Create new document entry
        const newDoc: UploadedDocument = {
            id: generateDocumentId(),
            filename: file.name,
            content,
            uploadedAt: Date.now(),
            charCount,
            fileType,
            platformHint: contextStatus.platform,
        };

        // Add to document store
        const updatedStore: DocumentStore = {
            documents: [...documentStore.documents, newDoc],
            activeDocIds: [...documentStore.activeDocIds, newDoc.id], // Auto-activate new doc
        };
        setDocumentStore(updatedStore);

        // Persist to storage
        const storage = getStorage();
        if (storage) await storage.set({ documentStore: updatedStore });

        const totalChars = updatedStore.documents.reduce((sum, d) => sum + d.charCount, 0);
        setContextStatus(prev => ({
            ...prev,
            hasDocument: true,
            documentName: `${updatedStore.documents.length} docs`,
            documentCharCount: totalChars,
            isProcessing: false,
            processingError: null,
        }));

        setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'assistant',
            text: `✅ Added **${file.name}** (${charCount.toLocaleString()} chars) to your knowledge base.\n\n📎 Use **@${file.name}** in chat to reference it specifically.\n\n${documentStore.documents.length > 0 ? '💡 When you use @mentions, **only those docs** will be used as knowledge. Toggle "Include Profile in KB" to also use your profile info.' : ''}`
        }]);

        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // Remove a document from the store
    const removeDocument = async (docId: string) => {
        const doc = documentStore.documents.find(d => d.id === docId);
        const updatedStore: DocumentStore = {
            documents: documentStore.documents.filter(d => d.id !== docId),
            activeDocIds: documentStore.activeDocIds.filter(id => id !== docId),
        };
        setDocumentStore(updatedStore);
        const storage = getStorage();
        if (storage) await storage.set({ documentStore: updatedStore });

        const totalChars = updatedStore.documents.reduce((sum, d) => sum + d.charCount, 0);
        setContextStatus(prev => ({
            ...prev,
            hasDocument: updatedStore.documents.length > 0,
            documentName: updatedStore.documents.length > 0 ? `${updatedStore.documents.length} docs` : null,
            documentCharCount: totalChars,
        }));

        setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'assistant',
            text: `📄 Removed **${doc?.filename || 'document'}** from knowledge base.`
        }]);
    };

    // Get combined project context from ONLY explicitly mentioned documents
    // This is FAANG-level strict: only @mentioned docs are used, others are ignored
    const getActiveProjectContext = (explicitMentions: string[]): { docContext: string | null; mentionedDocs: UploadedDocument[] } => {
        if (explicitMentions.length === 0) {
            // No docs mentioned - return nothing (profile may be used based on toggle)
            return { docContext: null, mentionedDocs: [] };
        }

        // Filter to ONLY the explicitly mentioned documents
        const mentionedDocs = documentStore.documents.filter(d =>
            explicitMentions.some(mention => {
                const mentionLower = mention.toLowerCase();
                const filenameLower = d.filename.toLowerCase();
                const nameWithoutExt = d.filename.split('.')[0].toLowerCase();
                // Match full filename OR name without extension
                return filenameLower === mentionLower ||
                    nameWithoutExt === mentionLower ||
                    filenameLower.includes(mentionLower) ||
                    nameWithoutExt.includes(mentionLower);
            })
        );

        if (mentionedDocs.length === 0) {
            return { docContext: null, mentionedDocs: [] };
        }

        const docContext = mentionedDocs.map(d => `--- ${d.filename} ---\n${d.content}`).join('\n\n');
        return { docContext, mentionedDocs };
    };

    // Parse @ mentions from input - FAANG-level extraction
    // Returns: { cleanQuery: string, mentionedNames: string[] }
    const parseAndExtractMentions = (text: string): { cleanQuery: string; mentionedNames: string[] } => {
        const mentionPattern = /@([\w\-_.]+)/g;
        const mentions: string[] = [];
        let match;

        while ((match = mentionPattern.exec(text)) !== null) {
            mentions.push(match[1]); // Extract name without @
        }

        // Return text with mentions removed for cleaner query
        const cleanQuery = text.replace(/@[\w\-_.]+/g, '').trim();
        return { cleanQuery, mentionedNames: mentions };
    };

    const handleSend = async () => {
        if (!input.trim()) return;

        // CRITICAL: Force-refresh the Firebase token before API call
        const freshToken = await refreshAuthToken(true);

        const userMsg: Message = { id: Date.now().toString(), role: 'user', text: input };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            // 1. Get Page Context from Content Script
            let context = { title: 'Unknown', url: '', content: '', forms: [] };

            try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (tab?.id) {
                    context = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_CONTEXT' });
                }
            } catch (e) {
                console.warn("Could not get page context:", e);
            }

            // 2. FAANG-level Knowledge Base Resolution
            // Extract @ mentions and get ONLY those specific documents
            const { cleanQuery, mentionedNames } = parseAndExtractMentions(userMsg.text);
            const { docContext, mentionedDocs } = getActiveProjectContext(mentionedNames);

            // Build knowledge base based on settings
            let includeProfile = false;

            if (mentionedDocs.length > 0) {
                // Docs were explicitly mentioned - use ONLY those docs
                // Include profile only if toggle is ON
                includeProfile = kbSettings.useProfileAsKnowledge;
                console.log(`[KB] Using ${mentionedDocs.length} mentioned doc(s):`, mentionedDocs.map(d => d.filename));
            } else {
                // No docs mentioned - auto-include profile (default behavior)
                includeProfile = kbSettings.autoProfileWhenNoDocs;
                console.log(`[KB] No docs mentioned. Profile auto-include: ${includeProfile}`);
            }

            // IMPORTANT: Send ONLY document content as project_context
            // Backend will handle profile inclusion separately based on include_profile flag
            const finalProjectContext = docContext;

            console.log(`[KB] Sending to backend:`, {
                hasDocContext: !!docContext,
                docContextLength: docContext?.length || 0,
                mentionedDocNames: mentionedDocs.map(d => d.filename),
                includeProfile
            });

            // CRITICAL: Store the last mentioned docs so sparkle can use ONLY these
            // This syncs the chat KB selection with sparkle button behavior
            const storage = getStorage();
            if (storage) {
                await storage.set({
                    lastMentionedDocs: mentionedDocs.map(d => ({ id: d.id, filename: d.filename })),
                    lastKbSettings: {
                        includeProfile,
                        hasMentionedDocs: mentionedDocs.length > 0
                    }
                });
            }
            console.log(`[KB] Stored last mentioned docs for sparkle sync:`, mentionedDocs.map(d => d.filename));

            const response = await fetch(ENDPOINTS.chat, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${freshToken}`
                },
                body: JSON.stringify({
                    query: cleanQuery,
                    page_context: context,
                    project_context: finalProjectContext,
                    mentioned_docs: mentionedDocs.map(d => d.filename),
                    include_profile: includeProfile
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Server Error: ${response.status} - ${errText}`);
            }

            const data = await response.json();
            const aiResponse = data.data;

            const aiMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                text: aiResponse.message || "I processed that, but have nothing to say."
            };
            setMessages(prev => [...prev, aiMsg]);

            // Handle Actions (Auto-fill)
            if (aiResponse.action && aiResponse.action.type === 'fill_field') {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (tab?.id) {
                    chrome.tabs.sendMessage(tab.id, {
                        type: 'FILL_FIELD',
                        selector: aiResponse.action.selector,
                        value: aiResponse.action.value
                    });
                }
            }

        } catch (error) {
            console.error("Chat Error:", error);
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'assistant',
                text: "Sorry, I couldn't reach the server. Please check your connection."
            }]);
        } finally {
            setLoading(false);
        }
    };

    const handleAutoFill = async () => {
        setLoading(true);
        // CRITICAL: Ensure token is fresh before telling content script to scan/gen
        await refreshAuthToken(true);
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab?.id) {
                // For auto-fill, use ALL documents (no @ mention filtering) + profile
                const allDocsContext = documentStore.documents.length > 0
                    ? documentStore.documents.map(d => `--- ${d.filename} ---\n${d.content}`).join('\n\n')
                    : null;

                // Build context with profile if available
                let fullContext = allDocsContext;
                if (userProfile) {
                    const profileSection = `--- USER PROFILE ---\n${JSON.stringify(userProfile, null, 2)}`;
                    fullContext = fullContext ? `${profileSection}\n\n${fullContext}` : profileSection;
                }

                const response = await chrome.tabs.sendMessage(tab.id, {
                    type: 'AUTO_FILL_REQUEST',
                    projectContext: fullContext || undefined
                });

                setMessages(prev => [...prev, {
                    id: Date.now().toString(),
                    role: 'assistant',
                    text: response.success
                        ? `✨ Magic! Auto-filled ${response.filled} fields based on your profile${documentStore.documents.length > 0 ? ` and ${documentStore.documents.length} doc(s)` : ''}.`
                        : `❌ Auto-fill failed: ${response.message || response.error}`
                }]);
            }
        } catch (e) {
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'assistant',
                text: "Could not communicate with the page. Try refreshing the page."
            }]);
        } finally {
            setLoading(false);
        }
    };
    
    const toggleRecording = async () => {
        if (isRecording) {
            // Stop recording
            chrome.runtime.sendMessage({ type: 'STOP_RECORDING' });
            setIsRecording(false);
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'assistant',
                text: "🔴 Stopped recording. I'm now indexing your session into my memory... This will take a few moments."
            }]);
        } else {
            // Start recording
            setLoading(true);
            try {
                const freshToken = await refreshAuthToken(true);
                const response = await fetch(`${ENDPOINTS.chat.replace('/chat', '')}/start-session`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${freshToken}` }
                });
                const data = await response.json();
                
                if (data.success) {
                    const { session_id, client_token } = data.session;
                    setActiveSessionId(session_id);
                    
                    // Tell background script to start capturing
                    chrome.runtime.sendMessage({ 
                        type: 'START_RECORDING', 
                        sessionId: session_id,
                        clientToken: client_token
                    });
                    
                    setIsRecording(true);
                    setMessages(prev => [...prev, {
                        id: Date.now().toString(),
                        role: 'assistant',
                        text: "🟢 Recording started! I'm now your eyes and ears. Everything you do in this tab will be remembered."
                    }]);
                }
            } catch (error) {
                console.error("Failed to start session:", error);
                setMessages(prev => [...prev, {
                    id: Date.now().toString(),
                    role: 'assistant',
                    text: "❌ Failed to start recording session. Please check your VideoDB configuration."
                }]);
            } finally {
                setLoading(false);
            }
        }
    };



    // Get context status color
    const getContextStatusColor = () => {
        const { profileCompleteness, hasDocument } = contextStatus;
        if (profileCompleteness >= 70 && hasDocument) return 'bg-green-500';
        if (profileCompleteness >= 40 || hasDocument) return 'bg-yellow-500';
        return 'bg-red-500';
    };

    const signInWithGoogle = async () => {
        setLoading(true);
        try {
            const { signInWithPopup } = await import('firebase/auth');
            const provider = new GoogleAuthProvider();
            const result = await signInWithPopup(auth, provider);
            const token = await result.user.getIdToken();
            
            setAuthToken(token);
            const storage = getStorage();
            if (storage) await storage.set({ authToken: token });
            
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'assistant',
                text: `Welcome, ${result.user.displayName}! You are now logged in.`
            }]);
        } catch (error: any) {
            console.error("Google Sign-in failed:", error);
            alert(`Sign-in failed: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    // --- UNIFIED AUTH LANDING (No Token) ---
    if (!authToken) {
        return (
            <div className="flex flex-col h-screen bg-slate-950 text-slate-100 p-6 items-center justify-center">
                <div className="w-full max-w-xs space-y-6">
                    <div className="flex flex-col items-center gap-2">
                        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20 mb-2 relative group cursor-pointer hover:scale-105 transition-transform">
                            <img src={chrome.runtime.getURL("ss_logo.png")} alt="Logo" className="w-10 h-10 object-contain relative z-10" />
                            <div className="absolute inset-0 bg-white/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all opacity-50" />
                        </div>
                        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
                            Informant
                        </h1>
                        <p className="text-sm text-slate-400 text-center px-4 leading-relaxed">
                            Unlock your AI Browser Co-Pilot to record, remember, and auto-fill.
                        </p>
                    </div>

                    <div className="space-y-3 pt-4">
                        <button
                            onClick={signInWithGoogle}
                            disabled={loading}
                            className="w-full bg-white hover:bg-slate-100 text-slate-900 font-bold py-3 rounded-xl transition-all flex justify-center items-center gap-3 shadow-lg active:scale-95 disabled:opacity-50"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                                <>
                                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
                                    <span>Sign in with Google</span>
                                </>
                            )}
                        </button>

                        <div className="flex items-center gap-2 py-2">
                            <div className="h-px bg-slate-800 flex-1" />
                            <span className="text-[10px] text-slate-600 uppercase font-bold tracking-widest">or</span>
                            <div className="h-px bg-slate-800 flex-1" />
                        </div>

                        <button
                            onClick={() => window.open('https://informant-i4i.web.app/login', '_blank')}
                            className="w-full bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 font-medium py-3 rounded-xl transition-all flex justify-center items-center gap-2 group active:scale-95"
                        >
                            <span>Open Web Dashboard</span>
                            <LogIn className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </button>
                    </div>

                    <div className="pt-8 border-t border-slate-900/50">
                        <div className="flex items-center justify-center gap-2 text-xs text-slate-500 italic">
                            <Bot className="w-3 h-3 text-blue-500" />
                            Secure Informant Handshake Active
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // --- MAIN APP (Authenticated) ---
    return (
        <div className="flex flex-col h-screen bg-slate-900 text-slate-100">
            {/* Header */}
            <header className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-950">
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${getContextStatusColor()} animate-pulse`} />
                    <img src={chrome.runtime.getURL("ss_logo.png")} alt="Logo" className="w-5 h-5 object-contain" />
                    <div className="flex flex-col">
                        <h1 className="font-bold text-sm leading-none truncate max-w-[120px]">
                            {userProfile?.name || userProfile?.full_name || 'Co-Pilot'}
                        </h1>
                        <span className="text-[10px] text-slate-400 leading-none truncate max-w-[120px]">
                            {userProfile?.email || 'Informant'}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => {
                            const storage = getStorage();
                            if (storage) storage.remove(['authToken', 'userProfile']);
                            setAuthToken(null);
                            setUserProfile(null);
                        }}
                        className="text-xs text-slate-500 hover:text-slate-300"
                        title="Sign Out"
                    >
                        Sign Out
                    </button>
                    <button
                        onClick={toggleRecording}
                        disabled={loading}
                        className={`${isRecording ? 'bg-red-600 hover:bg-red-500' : 'bg-slate-800 hover:bg-slate-700'} text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-1 transition-colors`}
                    >
                        {isRecording ? <Mic className="w-3 h-3 animate-pulse" /> : <MicOff className="w-3 h-3" />}
                        {isRecording ? 'Stop' : 'Record'}
                    </button>
                    <button
                        onClick={handleAutoFill}
                        disabled={loading}
                        className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-1 transition-colors"
                    >
                        <Sparkles className="w-3 h-3" /> Auto-Fill
                    </button>
                </div>
            </header>

            {/* Context Status Panel */}
            {showContextPanel && (
                <div className="p-3 bg-slate-950/50 border-b border-slate-800">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-slate-400 flex items-center gap-1">
                            <FileText className="w-3 h-3" /> Active Context
                        </span>
                        <button
                            onClick={() => setShowContextPanel(false)}
                            className="text-slate-500 hover:text-slate-300 p-0.5"
                            title="Collapse"
                        >
                            <ChevronUp className="w-3 h-3" />
                        </button>
                    </div>
                    <div className="space-y-2">
                        {/* Profile Status */}
                        <div className="flex items-center gap-2">
                            {contextStatus.profileCompleteness >= 70 ? (
                                <CheckCircle2 className="w-4 h-4 text-green-400" />
                            ) : contextStatus.profileCompleteness >= 40 ? (
                                <Circle className="w-4 h-4 text-yellow-400" />
                            ) : (
                                <Circle className="w-4 h-4 text-slate-500" />
                            )}
                            <span className="text-xs text-slate-300 flex-1">Profile</span>
                            <span className={`text-xs font-medium ${contextStatus.profileCompleteness >= 70 ? 'text-green-400' :
                                contextStatus.profileCompleteness >= 40 ? 'text-yellow-400' : 'text-slate-500'
                                }`}>
                                {contextStatus.profileCompleteness}%
                            </span>
                            <button
                                onClick={syncProfile}
                                disabled={isSyncingProfile}
                                className="text-slate-500 hover:text-blue-400 p-0.5"
                                title="Sync Profile"
                            >
                                <RefreshCw className={`w-3 h-3 ${isSyncingProfile ? 'animate-spin' : ''}`} />
                            </button>
                        </div>

                        {/* Document List - Multi-document support */}
                        <div className="space-y-1">
                            {contextStatus.isProcessing ? (
                                <div className="flex items-center gap-2">
                                    <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                                    <span className="text-xs text-slate-300">Processing...</span>
                                </div>
                            ) : documentStore.documents.length > 0 ? (
                                documentStore.documents.map((doc) => (
                                    <div key={doc.id} className="flex items-center gap-2 group">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                                        <span className="text-xs text-slate-300 flex-1 truncate" title={doc.filename}>
                                            {doc.filename}
                                        </span>
                                        <span className="text-[10px] text-slate-500">
                                            {(doc.charCount / 1000).toFixed(1)}k
                                        </span>
                                        <button
                                            onClick={() => removeDocument(doc.id)}
                                            className="text-slate-600 hover:text-red-400 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                            title="Remove document"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <div className="flex items-center gap-2">
                                    <Circle className="w-4 h-4 text-slate-500" />
                                    <span className="text-xs text-slate-400">No documents loaded</span>
                                </div>
                            )}
                        </div>

                        {/* @ Mention hint */}
                        {documentStore.documents.length > 1 && (
                            <div className="text-[10px] text-blue-400 bg-blue-500/10 px-2 py-1 rounded mt-1">
                                💡 Use @filename.ext in chat to reference specific docs
                            </div>
                        )}

                        {/* Profile as Knowledge Base Toggle - FAANG-level control */}
                        {documentStore.documents.length > 0 && (
                            <div className="mt-2 p-2 bg-slate-800/50 rounded-lg border border-slate-700/50">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <User className="w-3.5 h-3.5 text-purple-400" />
                                        <span className="text-[11px] text-slate-300">Include Profile in KB</span>
                                    </div>
                                    <button
                                        onClick={() => {
                                            const newSettings = { ...kbSettings, useProfileAsKnowledge: !kbSettings.useProfileAsKnowledge };
                                            setKbSettings(newSettings);
                                            const storage = getStorage();
                                            if (storage) storage.set({ kbSettings: newSettings }); // Persist
                                        }}
                                        className="focus:outline-none"
                                        title={kbSettings.useProfileAsKnowledge ? "Profile will be used as knowledge base alongside mentioned docs" : "Only mentioned docs will be used"}
                                    >
                                        {kbSettings.useProfileAsKnowledge ? (
                                            <ToggleRight className="w-6 h-6 text-purple-400" />
                                        ) : (
                                            <ToggleLeft className="w-6 h-6 text-slate-500" />
                                        )}
                                    </button>
                                </div>
                                <p className="text-[9px] text-slate-500 mt-1">
                                    {kbSettings.useProfileAsKnowledge
                                        ? "✅ Your profile info will be used alongside @mentioned docs"
                                        : "📄 Only @mentioned documents will be used as knowledge base"
                                    }
                                </p>
                            </div>
                        )}

                        {/* Processing Error */}
                        {contextStatus.processingError && (
                            <div className="text-xs text-red-400 bg-red-950/30 p-2 rounded border border-red-900/50">
                                {contextStatus.processingError}
                            </div>
                        )}

                        {/* Platform */}
                        <div className="flex items-center gap-2">
                            <Globe className="w-4 h-4 text-blue-400" />
                            <span className="text-xs text-slate-300 flex-1">Platform</span>
                            <span className="text-xs font-medium text-blue-400">{contextStatus.platform}</span>
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="flex gap-2 mt-3">
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={contextStatus.isProcessing}
                            className="flex-1 text-xs bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 py-1.5 px-2 rounded border border-slate-700 flex items-center justify-center gap-1"
                        >
                            {contextStatus.isProcessing ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                                <Plus className="w-3 h-3" />
                            )}
                            Add Document
                        </button>
                        <button
                            onClick={() => window.open('http://localhost:8080/profile', '_blank')}
                            className="flex-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 py-1.5 px-2 rounded border border-slate-700 flex items-center justify-center gap-1"
                        >
                            <User className="w-3 h-3" />
                            View Profile
                        </button>
                    </div>
                </div>
            )}

            {/* Collapsed Context Indicator */}
            {!showContextPanel && (
                <button
                    onClick={() => setShowContextPanel(true)}
                    className="px-3 py-1.5 bg-slate-950/50 border-b border-slate-800 flex items-center gap-2 hover:bg-slate-800/50 transition-colors"
                >
                    <div className="flex items-center gap-1">
                        {contextStatus.profileCompleteness >= 70 ? (
                            <span className="w-2 h-2 rounded-full bg-green-400" />
                        ) : (
                            <span className="w-2 h-2 rounded-full bg-yellow-400" />
                        )}
                        {contextStatus.hasDocument ? (
                            <span className="w-2 h-2 rounded-full bg-green-400" />
                        ) : (
                            <span className="w-2 h-2 rounded-full bg-slate-500" />
                        )}
                    </div>
                    <span className="text-xs text-slate-400 flex-1">
                        {contextStatus.platform} • {contextStatus.profileCompleteness}% profile
                        {contextStatus.hasDocument && ` • ${(contextStatus.documentCharCount / 1000).toFixed(1)}k chars`}
                    </span>
                    <ChevronDown className="w-3 h-3 text-slate-500" />
                </button>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map(msg => (
                    <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {msg.role === 'assistant' && (
                            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                                <Bot className="w-5 h-5" />
                            </div>
                        )}
                        <div className={`max-w-[85%] rounded-xl p-3 ${msg.role === 'user'
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-800 border border-slate-700'
                            }`}>
                            {/* Render @mentions as highlighted tags in user messages */}
                            {msg.role === 'user' ? (
                                <p className="text-sm whitespace-pre-wrap">
                                    {msg.text.split(/(@[\w\-_.]+)/g).map((part, i) =>
                                        part.startsWith('@') ? (
                                            <span key={i} className="inline-flex items-center bg-white/20 text-white px-1.5 py-0.5 rounded text-xs font-medium mx-0.5">
                                                <FileText className="w-3 h-3 mr-1" />
                                                {part.slice(1)}
                                            </span>
                                        ) : part
                                    )}
                                </p>
                            ) : (
                                <MarkdownMessage content={msg.text} role={msg.role} />
                            )}
                        </div>
                        {msg.role === 'user' && (
                            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center shrink-0">
                                <User className="w-5 h-5" />
                            </div>
                        )}
                    </div>
                ))}

                {loading && (
                    <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                            <Bot className="w-5 h-5 animate-pulse" />
                        </div>
                        <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
                            <div className="flex gap-1">
                                <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                                <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                                <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-slate-800 bg-slate-950">
                <div className="relative flex items-center gap-2">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        className="hidden"
                        accept=".txt,.md,.json,.csv,.pdf,.docx"
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={contextStatus.isProcessing}
                        className={`p-2 rounded-full transition-colors ${contextStatus.isProcessing
                            ? 'text-blue-400 bg-blue-500/10 animate-pulse'
                            : documentStore.documents.length > 0
                                ? 'text-green-400 bg-green-500/10'
                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                            }`}
                        title={contextStatus.isProcessing ? 'Processing...' : `Upload Document (${documentStore.documents.length} loaded)`}
                    >
                        {contextStatus.isProcessing ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <Plus className="w-5 h-5" />
                        )}
                    </button>

                    <div className="relative flex-1">
                        {/* @ Mention Dropdown - WhatsApp style */}
                        {showMentionDropdown && documentStore.documents.length > 0 && (
                            <div className="absolute bottom-full left-0 mb-2 w-full bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto">
                                <div className="px-3 py-1.5 text-[10px] text-slate-500 border-b border-slate-700 sticky top-0 bg-slate-800">
                                    📎 Select document to reference
                                </div>
                                {documentStore.documents
                                    .filter(doc => doc.filename.toLowerCase().includes(mentionFilter.toLowerCase()))
                                    .map((doc, index) => (
                                        <div
                                            key={doc.id}
                                            onMouseDown={(e) => {
                                                e.preventDefault(); // Prevent blur before click registers
                                                e.stopPropagation();
                                                // Insert doc with FULL filename including extension (FAANG standard)
                                                const beforeAt = input.slice(0, mentionCursorPos);
                                                const afterMention = input.slice(mentionCursorPos + mentionFilter.length + 1);
                                                const docRef = `@${doc.filename}`; // Full filename with extension
                                                const newInput = `${beforeAt}${docRef} ${afterMention}`.trim();
                                                setInput(newInput);
                                                setShowMentionDropdown(false);
                                                setMentionFilter('');
                                                setTimeout(() => inputRef.current?.focus(), 10);
                                            }}
                                            className={`px-3 py-2.5 text-sm hover:bg-blue-600/30 cursor-pointer flex items-center gap-2.5 transition-colors border-b border-slate-700/50 last:border-0 ${index === 0 ? 'bg-blue-600/20' : ''}`}
                                        >
                                            <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                                                <FileText className="w-4 h-4 text-blue-400" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <span className="text-slate-200 font-medium truncate block">{doc.filename}</span>
                                                <span className="text-[10px] text-slate-500">{(doc.charCount / 1000).toFixed(1)}k chars • {doc.fileType}</span>
                                            </div>
                                            <span className="text-xs text-blue-400 px-2 py-0.5 bg-blue-500/10 rounded-full">Select</span>
                                        </div>
                                    ))}
                                {documentStore.documents.filter(doc => doc.filename.toLowerCase().includes(mentionFilter.toLowerCase())).length === 0 && (
                                    <div className="px-3 py-3 text-sm text-slate-500 text-center">No matching documents</div>
                                )}
                            </div>
                        )}
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={e => {
                                const newValue = e.target.value;
                                setInput(newValue);
                                e.target.style.height = 'auto';
                                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';

                                // Check for @ mention trigger
                                const cursorPos = e.target.selectionStart || 0;
                                const textBeforeCursor = newValue.slice(0, cursorPos);
                                const lastAtIndex = textBeforeCursor.lastIndexOf('@');

                                if (lastAtIndex !== -1) {
                                    const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
                                    // Only show dropdown if no space after @ (still typing doc name)
                                    if (!textAfterAt.includes(' ')) {
                                        setMentionFilter(textAfterAt);
                                        setMentionCursorPos(lastAtIndex);
                                        setShowMentionDropdown(true);
                                    } else {
                                        setShowMentionDropdown(false);
                                    }
                                } else {
                                    setShowMentionDropdown(false);
                                }
                            }}
                            onKeyDown={e => {
                                if (e.key === 'Escape' && showMentionDropdown) {
                                    e.preventDefault();
                                    setShowMentionDropdown(false);
                                    return;
                                }
                                // Arrow key navigation in dropdown
                                if (showMentionDropdown && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Tab')) {
                                    e.preventDefault();
                                    // For simplicity, Tab/Enter selects first match
                                    const firstMatch = documentStore.documents.find(doc =>
                                        doc.filename.toLowerCase().includes(mentionFilter.toLowerCase())
                                    );
                                    if (firstMatch && (e.key === 'Tab')) {
                                        const beforeAt = input.slice(0, mentionCursorPos);
                                        const afterMention = input.slice(mentionCursorPos + mentionFilter.length + 1);
                                        setInput(`${beforeAt}@${firstMatch.filename} ${afterMention}`.trim()); // Full filename
                                        setShowMentionDropdown(false);
                                        setMentionFilter('');
                                    }
                                    return;
                                }
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    if (showMentionDropdown) {
                                        e.preventDefault();
                                        // Select first matching doc
                                        const firstMatch = documentStore.documents.find(doc =>
                                            doc.filename.toLowerCase().includes(mentionFilter.toLowerCase())
                                        );
                                        if (firstMatch) {
                                            const beforeAt = input.slice(0, mentionCursorPos);
                                            const afterMention = input.slice(mentionCursorPos + mentionFilter.length + 1);
                                            setInput(`${beforeAt}@${firstMatch.filename} ${afterMention}`.trim()); // Full filename
                                            setShowMentionDropdown(false);
                                            setMentionFilter('');
                                        }
                                        return;
                                    }
                                    e.preventDefault();
                                    handleSend();
                                    // Reset height
                                    const target = e.target as HTMLTextAreaElement;
                                    target.style.height = '44px';
                                }
                            }}
                            placeholder={isListening ? "Listening..." : "Ask Co-Pilot... (use @ to mention docs)"}
                            className={`w-full bg-slate-800 border-none rounded-xl py-3 pl-4 pr-20 focus:ring-2 focus:ring-blue-600 text-sm resize-none overflow-y-auto scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent ${isListening ? 'ring-2 ring-red-500 animate-pulse' : ''}`}
                            style={{ height: input.trim() ? undefined : '44px', minHeight: '44px', maxHeight: '120px' }}
                            rows={1}
                        />
                        <button
                            onClick={toggleVoice}
                            className={`absolute right-10 top-1/2 -translate-y-1/2 p-1.5 rounded-full transition-colors ${isListening ? 'text-red-500 hover:text-red-400' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                        </button>
                        <button
                            onClick={handleSend}
                            disabled={!input.trim() || loading}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-blue-600 rounded-full hover:bg-blue-500 disabled:opacity-50 transition-colors"
                        >
                            <Send className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}