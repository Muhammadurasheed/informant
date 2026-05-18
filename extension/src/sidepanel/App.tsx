import React, { useState, useRef, useEffect } from 'react';
import { 
    Send, Sparkles, Bot, LogIn, Loader2, Play, Square, Video, 
    User, Mail, Lock, ArrowRight, Github, LogOut, FileText, 
    Upload, X, Trash2, ChevronDown, ChevronUp, BookOpen,
    Mic, Volume2, VolumeX, History, Clock, Compass, ExternalLink
} from 'lucide-react';
import { ENDPOINTS, getStorage, isExtensionValid, parseDocument } from '../config';
import { MarkdownMessage } from './MarkdownMessage';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    text: string;
    evidence?: any[];
}

interface Document {
    id: string;
    name: string;
    content: string;
    activeForAutofill?: boolean;
}


export default function App() {
    const [messages, setMessages] = useState<Message[]>([
        { 
            id: '1', 
            role: 'assistant', 
            text: 'Hello! I\'m **Informant**, your AI Browser Co-Pilot.\n\nI see everything you browse and remember it all. Click **▶ Start Session** to give me eyes.' 
        }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const [authToken, setAuthToken] = useState<string | null>(null);
    const [userProfile, setUserProfile] = useState<any>(null);
    const [indexingCount, setIndexingCount] = useState(0);
    const [indexingStatus, setIndexingStatus] = useState<'idle' | 'uploading' | 'indexing' | 'ready' | 'failed'>('idle');
    const [indexingBannerMsg, setIndexingBannerMsg] = useState('');
    const [authMode, setAuthMode] = useState<'welcome' | 'email-signin' | 'email-signup'>('welcome');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [authError, setAuthError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'chat' | 'history' | 'knowledge'>('chat');
    const [uploadedDocs, setUploadedDocs] = useState<Document[]>([]);
    const [uploading, setUploading] = useState(false);

    // Voice interaction state
    const [isListening, setIsListening] = useState(false);
    const [autoSpeak, setAutoSpeak] = useState(true);
    const [micPermissionNeeded, setMicPermissionNeeded] = useState(false);
    const recognitionRef = useRef<any>(null);
    const speechTranscriptRef = useRef<string>('');
    const speechDebounceTimerRef = useRef<any>(null);

    // Smart Browsing History state
    const [historyItems, setHistoryItems] = useState<any[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages]);

    // Handle one-time microphone permission request tab
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('requestMic')) {
            navigator.mediaDevices.getUserMedia({ audio: true })
                .then(() => {
                    alert("✅ Voice Permission Granted Flawlessly! Chrome will now remember this permanent permission. You can close this tab and speak to Informant in your side panel.");
                    try { window.close(); } catch(e){}
                })
                .catch((err) => {
                    alert("❌ Microphone permission denied. Please click the microphone icon in your address bar (top right) and select 'Always allow'.");
                });
        }
    }, []);

    // Load History when active tab changes
    useEffect(() => {
        if (activeTab === 'history' && authToken) {
            setLoadingHistory(true);
            fetch(ENDPOINTS.history, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            })
            .then(res => res.json())
            .then(data => {
                if (data.success && data.history) {
                    setHistoryItems(data.history);
                }
            })
            .catch(err => console.error("History fetch error:", err))
            .finally(() => setLoadingHistory(false));
        }
    }, [activeTab, authToken]);

    // Load Auth and Docs
    useEffect(() => {
        const storage = getStorage();
        if (!storage) return;

        storage.get(['authToken', 'userProfile', 'uploadedDocs'], (result) => {
            if (result.authToken) setAuthToken(result.authToken);
            if (result.userProfile) setUserProfile(result.userProfile);
            if (result.uploadedDocs) setUploadedDocs(result.uploadedDocs);
        });

        const listener = (changes: any, area: string) => {
            if (area === 'local') {
                if (changes.authToken) setAuthToken(changes.authToken.newValue);
                if (changes.userProfile) setUserProfile(changes.userProfile.newValue);
                if (changes.uploadedDocs) setUploadedDocs(changes.uploadedDocs.newValue);
            }
        };

        if (isExtensionValid()) {
            chrome.storage.onChanged.addListener(listener);
            
            chrome.runtime.onMessage.addListener((msg) => {
                if (msg.type === 'AUTH_STATE_CHANGED' && msg.authenticated) {
                    setLoading(false);
                    setAuthError(null);
                } else if (msg.type === 'AUTH_ERROR') {
                    setLoading(false);
                    setAuthError(msg.error || 'Authentication failed');
                } else if (msg.type === 'CAPTURE_STARTED') {
                    setIsRecording(true);
                    setActiveSessionId(msg.sessionId);
                    setIndexingStatus('idle');
                } else if (msg.type === 'CAPTURE_STOPPED') {
                    setIsRecording(false);
                    setActiveSessionId(null);
                } else if (msg.type === 'CHUNK_ACQUIRED_UI') {
                    setIndexingCount(prev => prev + 1);
                } else if (msg.type === 'INDEXING_STARTED') {
                    if (msg.phase === 'uploading') {
                        setIndexingStatus('uploading');
                        setIndexingBannerMsg('🔄 Uploading captured memory chunks...');
                    } else {
                        setIndexingStatus('indexing');
                        setIndexingBannerMsg('⚡ VideoDB indexing visual scenes & speech...');
                    }
                } else if (msg.type === 'INDEXING_COMPLETE') {
                    setIndexingStatus('ready');
                    setMessages(prev => [...prev, {
                        id: Date.now().toString(),
                        role: 'assistant',
                        text: `✅ **Memory Fully Indexed!** (${msg.videosIndexed || 1} video session ready).\n\nYou can now ask me any question about the pages you browsed.`
                    }]);
                } else if (msg.type === 'INDEXING_FAILED') {
                    setIndexingStatus('failed');
                    setIndexingBannerMsg(`❌ Indexing error: ${msg.detail || msg.reason}`);
                }
            });
        }
    }, []);

    const handleLogout = () => {
        chrome.storage.local.clear(() => {
            setAuthToken(null);
            setUserProfile(null);
            setUploadedDocs([]);
            setAuthMode('welcome');
        });
    };

    const handleGoogleSignIn = () => {
        setLoading(true);
        chrome.runtime.sendMessage({ type: 'SIGN_IN_WITH_GOOGLE' });
    };

    const handleGuestSignIn = () => {
        setLoading(true);
        const guestData = {
            uid: 'demo_guest_user',
            email: 'guest@informant.ai',
            displayName: 'Hackathon Guest'
        };
        chrome.storage.local.set({ 
            authToken: 'GUEST_TOKEN',
            userProfile: guestData
        }, () => {
            setAuthToken('GUEST_TOKEN');
            setUserProfile(guestData);
            setLoading(false);
        });
    };

    const handleEmailSignIn = (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        chrome.runtime.sendMessage({ 
            type: authMode === 'email-signin' ? 'SIGN_IN_WITH_EMAIL' : 'SIGN_UP_WITH_EMAIL',
            email, 
            password 
        });
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !authToken) return;

        setUploading(true);
        try {
            const result = await parseDocument(file, authToken);
            if (result.success) {
                const newDoc: Document = {
                    id: `doc_${Date.now()}`,
                    name: file.name,
                    content: result.content,
                    activeForAutofill: true
                };
                const updatedDocs = [...uploadedDocs, newDoc];
                setUploadedDocs(updatedDocs);
                chrome.storage.local.set({ uploadedDocs: updatedDocs });
            }
        } catch (err) {
            console.error("Upload failed", err);
        } finally {
            setUploading(false);
        }
    };

    const deleteDoc = (id: string) => {
        const updatedDocs = uploadedDocs.filter(d => d.id !== id);
        setUploadedDocs(updatedDocs);
        chrome.storage.local.set({ uploadedDocs: updatedDocs });
    };

    const toggleDocAutofill = (id: string) => {
        const updatedDocs = uploadedDocs.map(d => d.id === id ? { ...d, activeForAutofill: d.activeForAutofill === false ? true : false } : d);
        setUploadedDocs(updatedDocs);
        chrome.storage.local.set({ uploadedDocs: updatedDocs });
    };

    const deleteHistoryItem = async (videoId: string) => {
        if (!authToken) return;
        if (!confirm("Are you sure you want to permanently delete this memory session?")) return;
        
        try {
            const response = await fetch(`${ENDPOINTS.history}/${videoId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            const data = await response.json();
            if (data.success) {
                setHistoryItems(prev => prev.filter(item => item.video_id !== videoId));
            } else {
                alert("Failed to delete history item: " + (data.error || "Unknown error"));
            }
        } catch (err) {
            console.error("Delete history item error:", err);
            alert("Failed to delete history item due to network/server error.");
        }
    };

    const toggleRecording = async () => {
        if (isRecording) {
            setLoading(true);
            try {
                chrome.runtime.sendMessage({ type: 'STOP_RECORDING' });
                setMessages(prev => [...prev, {
                    id: Date.now().toString(),
                    role: 'assistant',
                    text: "🔴 **Session Stopped.**\nUploading and indexing your browsing memory..."
                }]);
            } catch (err) {
                console.error("Stop failed", err);
            } finally {
                setLoading(false);
            }
        } else {
            setLoading(true);
            try {
                const response = await fetch(ENDPOINTS.startSession, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${authToken}` }
                });
                const data = await response.json();
                if (data.success) {
                    const session_id = data.session.session_id;
                    setActiveSessionId(session_id);
                    setIndexingCount(0); // Reset for new session
                    chrome.runtime.sendMessage({ type: 'START_RECORDING', sessionId: session_id });
                    setMessages(prev => [...prev, {
                        id: Date.now().toString(),
                        role: 'assistant',
                        text: "🟢 **Session Live — I'm watching and remembering...**"
                    }]);
                }
            } catch (error) {
                setMessages(prev => [...prev, {
                    id: Date.now().toString(),
                    role: 'assistant',
                    text: "❌ Failed to start recording session. Please check connection."
                }]);
            } finally {
                setLoading(false);
            }
        }
    };

    const submitMessage = async (msgText: string) => {
        if (!msgText.trim() || !authToken) return;

        const userMsg: Message = { id: Date.now().toString(), role: 'user', text: msgText };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        speechTranscriptRef.current = '';
        setLoading(true);

        try {
            const activeDocs = uploadedDocs.filter(d => d.activeForAutofill !== false);
            const projectContext = activeDocs.map(d => `[Active Knowledge Document: ${d.name}]\n${d.content}`).join('\n\n');

            let pageContext = { title: 'Unknown', url: '' };
            try {
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (tab?.id) {
                    pageContext = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_CONTEXT' });
                }
            } catch (e) {}

            const response = await fetch(ENDPOINTS.chat, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    query: userMsg.text,
                    page_context: pageContext,
                    project_context: projectContext,
                    include_profile: true
                })
            });

            const data = await response.json();
            const aiMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                text: data.data.message,
                evidence: data.data.evidence
            };
            setMessages(prev => [...prev, aiMsg]);

            if (autoSpeak && data.data.message) {
                speakText(data.data.message);
            }

        } catch (error) {
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'assistant',
                text: "Sorry, I couldn't reach the server."
            }]);
        } finally {
            setLoading(false);
        }
    };

    const handleSend = () => {
        submitMessage(input);
    };

    const toggleListening = async () => {
        if (isListening && recognitionRef.current) {
            if (speechDebounceTimerRef.current) clearTimeout(speechDebounceTimerRef.current);
            recognitionRef.current.stop();
            setIsListening(false);
            return;
        }

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("Speech recognition is not supported in this browser. Please use Google Chrome.");
            return;
        }

        try {
            // Ensure audio stream permission is explicitly granted by Chrome
            try {
                await navigator.mediaDevices.getUserMedia({ audio: true });
                setMicPermissionNeeded(false);
            } catch (mediaErr) {
                console.error("Microphone permission denied in side panel frame:", mediaErr);
                setMicPermissionNeeded(true);
                return;
            }

            const recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'en-US';

            recognition.onstart = () => {
                setIsListening(true);
                speechTranscriptRef.current = '';
                if (speechDebounceTimerRef.current) clearTimeout(speechDebounceTimerRef.current);
            };

            recognition.onend = () => {
                setIsListening(false);
                if (speechDebounceTimerRef.current) clearTimeout(speechDebounceTimerRef.current);
                
                const finalSpeech = speechTranscriptRef.current.trim();
                if (finalSpeech.length > 0) {
                    console.log("[Informant Voice] Speech finished. Submitting:", finalSpeech);
                    submitMessage(finalSpeech);
                }
            };

            recognition.onerror = (e: any) => {
                console.error("Speech error", e);
                setIsListening(false);
                if (speechDebounceTimerRef.current) clearTimeout(speechDebounceTimerRef.current);
            };

            recognition.onresult = (event: any) => {
                let interimTranscript = '';
                let finalTranscript = '';
                
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    const transcript = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        finalTranscript += transcript;
                    } else {
                        interimTranscript += transcript;
                    }
                }
                
                if (finalTranscript) {
                    speechTranscriptRef.current = (speechTranscriptRef.current + ' ' + finalTranscript).trim().replace(/\s+/g, ' ');
                }
                
                const displayedText = (speechTranscriptRef.current + ' ' + interimTranscript).trim().replace(/\s+/g, ' ');
                setInput(displayedText);
                
                // Clear any existing silence timer
                if (speechDebounceTimerRef.current) clearTimeout(speechDebounceTimerRef.current);
                
                // If there's some active speech, schedule auto-submit after 2.5 seconds of silence
                if (displayedText.length > 0) {
                    speechDebounceTimerRef.current = setTimeout(() => {
                        console.log("[Informant Voice] 2.5s silence detected. Stopping capture and auto-submitting.");
                        recognition.stop();
                    }, 2500);
                }
            };

            recognition.start();
            recognitionRef.current = recognition;
        } catch (e) {
            console.error("Failed to start speech recognition", e);
            setIsListening(false);
        }
    };

    const speakText = (text: string) => {
        if (!window.speechSynthesis) return;
        window.speechSynthesis.cancel();
        const cleanText = text.replace(/[*#_`]/g, '');
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
    };

    if (!authToken) {
        return (
            <div className="flex flex-col h-screen bg-[#0a0a0f] text-slate-100 p-8 items-center justify-center overflow-hidden relative">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/10 rounded-full blur-[100px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 rounded-full blur-[100px]" />

                <div className="w-full max-w-sm space-y-8 relative z-10">
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-[24px] flex items-center justify-center shadow-2xl group transform transition-transform hover:scale-105">
                            <Bot className="w-10 h-10 text-white" />
                        </div>
                        <div className="text-center">
                            <h1 className="text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-white to-purple-400 tracking-tight">Informant</h1>
                            <p className="text-slate-400 mt-2 text-sm font-medium tracking-wide uppercase">YOUR BROWSER CO-PILOT</p>
                        </div>
                    </div>

                    {authMode === 'welcome' ? (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <button
                                onClick={handleGoogleSignIn}
                                disabled={loading}
                                className="w-full bg-white text-slate-900 font-bold py-4 rounded-2xl transition-all flex justify-center items-center gap-3 shadow-lg hover:bg-slate-100 active:scale-[0.98]"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                                    <>
                                        <svg width="20" height="20" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                                        <span>Continue with Google</span>
                                    </>
                                )}
                            </button>

                            <button
                                onClick={handleGuestSignIn}
                                disabled={loading}
                                className="w-full bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 font-bold py-4 rounded-2xl transition-all flex justify-center items-center gap-3 hover:bg-indigo-600/20"
                            >
                                <Sparkles className="w-5 h-5" />
                                <span>Enter as Hackathon Guest</span>
                            </button>
                            
                            <div className="relative py-2">
                                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-800"></div></div>
                                <div className="relative flex justify-center text-[10px] uppercase"><span className="bg-[#0a0a0f] px-4 text-slate-500 font-bold">or</span></div>
                            </div>

                            <button
                                onClick={() => setAuthMode('email-signin')}
                                className="w-full bg-slate-900 border border-slate-800 text-slate-200 font-bold py-4 rounded-2xl flex justify-center items-center gap-3 hover:bg-slate-800"
                            >
                                <Mail className="w-5 h-5" />
                                <span>Sign in with Email</span>
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleEmailSignIn} className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-500">
                            {authError && <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs text-center">{authError}</div>}
                            <div className="space-y-2">
                                <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500" required />
                                <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500" required />
                            </div>
                            <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold py-4 rounded-2xl transition-all flex justify-center items-center gap-2">
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <span>{authMode === 'email-signin' ? 'Sign In' : 'Create Account'}</span>}
                            </button>
                            <button type="button" onClick={() => setAuthMode(authMode === 'email-signin' ? 'email-signup' : 'email-signin')} className="w-full text-slate-400 text-xs font-bold hover:text-white">
                                {authMode === 'email-signin' ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
                            </button>
                            <button type="button" onClick={() => setAuthMode('welcome')} className="w-full text-slate-600 text-[11px] font-bold tracking-widest uppercase mt-4">← Back</button>
                        </form>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-[#0a0a0f] text-slate-100">
            {/* Header */}
            <header className="px-5 py-4 border-b border-white/5 bg-[#0f0f18]/80 backdrop-blur-xl flex items-center justify-between shadow-2xl relative z-20">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <div className={`w-3 h-3 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} />
                        {isRecording && <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-40" />}
                    </div>
                    <div className="flex flex-col">
                        <h1 className="font-bold text-[14px] bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">Informant</h1>
                        {isRecording && (
                            <span className="text-[9px] text-indigo-400 font-black uppercase tracking-widest flex items-center gap-1.5 animate-in fade-in slide-in-from-left-2">
                                <Video className="w-2.5 h-2.5" /> {indexingCount} Memories Captured
                            </span>
                        )}
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    <button
                        onClick={toggleRecording}
                        disabled={loading}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all ${
                            isRecording ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-white text-slate-900'
                        }`}
                    >
                        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : isRecording ? <><Square className="w-2.5 h-2.5 fill-current" /> Stop</> : <><Play className="w-3 h-3 fill-current" /> Start</>}
                    </button>
                    <button onClick={handleLogout} className="p-2 text-slate-500 hover:text-red-400 transition-colors">
                        <LogOut className="w-4 h-4" />
                    </button>
                </div>
            </header>

            {/* Tabs */}
            <div className="flex border-b border-white/5 bg-[#0f0f18]">
                <button 
                    onClick={() => setActiveTab('chat')}
                    className={`flex-1 py-3 text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${activeTab === 'chat' ? 'text-indigo-400 border-b-2 border-indigo-400 bg-indigo-500/5' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    <Bot className="w-3.5 h-3.5" /> Chat
                </button>
                <button 
                    onClick={() => setActiveTab('history')}
                    className={`flex-1 py-3 text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${activeTab === 'history' ? 'text-indigo-400 border-b-2 border-indigo-400 bg-indigo-500/5' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    <History className="w-3.5 h-3.5" /> History
                </button>
                <button 
                    onClick={() => setActiveTab('knowledge')}
                    className={`flex-1 py-3 text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${activeTab === 'knowledge' ? 'text-indigo-400 border-b-2 border-indigo-400 bg-indigo-500/5' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    <BookOpen className="w-3.5 h-3.5" /> Knowledge ({uploadedDocs.length})
                </button>
            </div>

            {/* Indexing Progress Banner */}
            {(indexingStatus === 'uploading' || indexingStatus === 'indexing' || indexingStatus === 'failed') && (
                <div className={`px-4 py-2.5 text-xs font-bold flex items-center gap-2.5 shadow-inner transition-all animate-in fade-in ${
                    indexingStatus === 'failed' 
                        ? 'bg-red-500/10 text-red-400 border-b border-red-500/20' 
                        : 'bg-indigo-500/10 text-indigo-300 border-b border-indigo-500/20'
                }`}>
                    {indexingStatus !== 'failed' && <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />}
                    <span>{indexingBannerMsg}</span>
                    {indexingStatus !== 'failed' && (
                        <span className="ml-auto text-[9px] uppercase tracking-widest opacity-70 font-black">Processing in Background</span>
                    )}
                </div>
            )}

            {/* Content Area */}
            <div className="flex-1 overflow-hidden relative">
                {activeTab === 'chat' ? (
                    <div className="h-full flex flex-col">
                        <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
                            {messages.map(msg => (
                                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2`}>
                                    <div className={`max-w-[85%] rounded-[24px] p-4 ${
                                        msg.role === 'user' 
                                            ? 'bg-gradient-to-br from-indigo-600 to-indigo-700 text-white rounded-tr-none shadow-lg' 
                                            : 'bg-[#1a1a2e] text-slate-200 rounded-tl-none border border-white/10 shadow-xl'
                                    }`}>
                                        {msg.role === 'assistant' && (
                                            <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-white/5">
                                                <span className="text-[10px] font-black tracking-wider uppercase opacity-60">Informant Co-Pilot</span>
                                                <button onClick={() => speakText(msg.text)} className="p-1 text-slate-400 hover:text-indigo-300 transition-colors" title="Speak message aloud">
                                                    <Volume2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        )}
                                        <div className="text-[14px] leading-relaxed">
                                            <MarkdownMessage content={msg.text} role={msg.role} />
                                        </div>
                                        {msg.evidence?.map((ev, i) => ev.playback_url && (
                                            <a key={i} href={ev.playback_url} target="_blank" rel="noopener noreferrer" 
                                               className="mt-4 flex items-center gap-3 p-3 rounded-2xl bg-black/40 border border-white/5 hover:border-indigo-500/50 transition-all group overflow-hidden relative">
                                                <div className="absolute inset-0 bg-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                                                    <Play className="w-4 h-4 text-indigo-400 group-hover:text-white fill-current" />
                                                </div>
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-[11px] font-bold text-slate-300 group-hover:text-white transition-colors">View Playable Evidence</span>
                                                    <span className="text-[9px] text-slate-500 font-medium">Memory from {Math.floor(ev.start)}s</span>
                                                </div>
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            ))}
                            {loading && <div className="flex items-center gap-3 text-slate-500 text-xs px-2"><Loader2 className="w-4 h-4 animate-spin text-indigo-500" /> Thinking...</div>}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="p-4 bg-[#0f0f18] border-t border-white/5 space-y-2.5">
                            <div className="flex items-center justify-between px-1">
                                <button onClick={() => setAutoSpeak(!autoSpeak)} className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-lg transition-all ${autoSpeak ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30' : 'bg-white/5 text-slate-500 hover:text-slate-300'}`}>
                                    {autoSpeak ? <><Volume2 className="w-3 h-3 text-indigo-400" /> Voice Response: ON</> : <><VolumeX className="w-3 h-3 text-slate-500" /> Voice Response: OFF</>}
                                </button>
                                <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">{isRecording ? 'Capturing Memory' : 'Memory Standby'}</span>
                            </div>

                            {isListening && (
                                <div className="px-4 py-2 bg-gradient-to-r from-red-500/20 via-purple-500/20 to-indigo-500/20 border border-red-500/30 rounded-2xl flex items-center gap-3 animate-pulse">
                                    <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                                    <span className="text-xs font-bold text-red-200">🎙️ Listening... Speak now (Will auto-submit when you pause)</span>
                                </div>
                            )}

                            {micPermissionNeeded && (
                                <div className="p-4 bg-[#151522] border-2 border-indigo-500/50 rounded-2xl space-y-3 animate-in fade-in shadow-2xl">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                                            <Mic className="w-4 h-4 text-indigo-400 animate-pulse" />
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-bold text-white">Microphone Access Required</h4>
                                            <p className="text-[11px] text-slate-300">Chrome requires you to grant voice access in a full tab before using voice mode in the side panel.</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 pt-1">
                                        <button 
                                            onClick={() => {
                                                chrome.tabs.create({ url: chrome.runtime.getURL('sidepanel.html?requestMic=true') });
                                                setMicPermissionNeeded(false);
                                            }}
                                            className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
                                        >
                                            <Play className="w-3 h-3 fill-current" /> Grant Voice Access in Chrome
                                        </button>
                                        <button 
                                            onClick={() => setMicPermissionNeeded(false)}
                                            className="px-3 py-2 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-xs font-bold rounded-xl transition-all"
                                        >
                                            Dismiss
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="relative">
                                <textarea
                                    ref={inputRef}
                                    value={input}
                                    onChange={e => setInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
                                    placeholder="Ask about what you browsed or speak..."
                                    className="w-full bg-black/40 border border-slate-800 rounded-2xl pl-4 pr-24 py-3.5 text-[13px] text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 transition-all resize-none min-h-[50px] max-h-[120px]"
                                    rows={1}
                                />
                                <div className="absolute right-2 bottom-2 flex items-center gap-1.5">
                                    <button onClick={toggleListening} className={`p-2.5 rounded-xl transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-800 text-slate-400 hover:text-white'}`} title={isListening ? "Listening... Click to stop" : "Click to speak"}>
                                        <Mic className="w-4 h-4" />
                                    </button>
                                    <button onClick={handleSend} disabled={!input.trim() || loading} className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 disabled:opacity-30">
                                        <Send className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : activeTab === 'history' ? (
                    <div className="h-full p-5 flex flex-col space-y-6 overflow-y-auto custom-scrollbar">
                        <div className="space-y-2">
                            <h2 className="text-[12px] font-black uppercase tracking-widest text-slate-500 flex items-center justify-between">
                                <span className="flex items-center gap-2"><History className="w-3.5 h-3.5 text-indigo-400" /> AI Browsing Memory Timeline</span>
                                <span className="text-[10px] text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-full font-bold">{historyItems.length} SESSIONS</span>
                            </h2>
                            <p className="text-[11px] text-slate-400">Captured browsing sessions organized and summarized by Informant AI multimodal perception.</p>
                        </div>

                        {loadingHistory ? (
                            <div className="flex flex-col items-center justify-center p-12 text-slate-500 space-y-3">
                                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                                <span className="text-xs font-bold">Loading VideoDB browsing memory...</span>
                            </div>
                        ) : historyItems.length === 0 ? (
                            <div className="p-10 text-center text-slate-600 text-xs border border-white/5 rounded-3xl bg-white/5 flex flex-col items-center gap-3 shadow-inner">
                                <Compass className="w-8 h-8 text-slate-600" />
                                <span>No browsing history found. Start a capture session with Ctrl+B to start remembering!</span>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {historyItems.map((item) => (
                                    <div key={item.id} className="p-5 rounded-2xl bg-[#151522] border border-white/5 space-y-3 shadow-xl hover:border-white/10 transition-all group">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div className="w-7 h-7 rounded-lg bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                                                    <Clock className="w-3.5 h-3.5 text-indigo-400" />
                                                </div>
                                                <h3 className="text-xs font-bold text-slate-200 group-hover:text-indigo-300 transition-colors truncate">{item.title}</h3>
                                            </div>
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                <span className="text-[10px] font-bold text-indigo-400/80 bg-indigo-500/10 px-2.5 py-0.5 rounded-md">{item.duration_str}</span>
                                                <button 
                                                    onClick={() => deleteHistoryItem(item.video_id)}
                                                    className="p-1 text-slate-500 hover:text-red-400 rounded-lg hover:bg-white/5 transition-colors"
                                                    title="Delete Session"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>

                                        <p className="text-[12px] leading-relaxed text-slate-300">{item.summary}</p>

                                        {item.stream_url && (
                                            <div className="pt-3 flex items-center justify-between border-t border-white/5">
                                                <span className="text-[10px] text-slate-500 font-mono truncate max-w-[180px]">{item.name}</span>
                                                <a href={item.stream_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors">
                                                    <Play className="w-3 h-3 fill-current" /> Watch Stream <ExternalLink className="w-3 h-3" />
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="h-full p-5 flex flex-col space-y-6 overflow-y-auto custom-scrollbar">
                        <div className="space-y-4">
                            <h2 className="text-[12px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                                <Upload className="w-3.5 h-3.5" /> Upload Documents
                            </h2>
                            <p className="text-[11px] text-slate-400">Add resumes, grant proposals, or requirements to help me fill forms and answer questions with better context.</p>
                            
                            <div 
                                onClick={() => fileInputRef.current?.click()}
                                className="border-2 border-dashed border-white/10 rounded-2xl p-8 flex flex-col items-center gap-3 hover:bg-white/5 cursor-pointer transition-all hover:border-indigo-500/30 group"
                            >
                                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-indigo-500/20 transition-all">
                                    {uploading ? <Loader2 className="w-6 h-6 animate-spin text-indigo-500" /> : <Upload className="w-6 h-6 text-slate-500 group-hover:text-indigo-400" />}
                                </div>
                                <span className="text-xs font-bold text-slate-500 group-hover:text-slate-300">
                                    {uploading ? 'Parsing Document...' : 'Drop files or Click to Upload'}
                                </span>
                                <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".pdf,.txt,.docx" />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h2 className="text-[12px] font-black uppercase tracking-widest text-slate-500 flex items-center justify-between">
                                <div className="flex items-center gap-2"><FileText className="w-3.5 h-3.5" /> Knowledge Base</div>
                                <span className="text-[10px] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full">{uploadedDocs.length} DOCS</span>
                            </h2>
                            
                            <div className="space-y-2">
                                {uploadedDocs.length === 0 ? (
                                    <div className="p-8 text-center text-slate-600 text-xs border border-white/5 rounded-2xl bg-white/5 italic">No documents uploaded yet.</div>
                                ) : (
                                    uploadedDocs.map(doc => (
                                        <div key={doc.id} className={`flex items-center justify-between p-4 rounded-xl border group transition-all ${doc.activeForAutofill !== false ? 'bg-[#151522] border-indigo-500/30 shadow-lg' : 'bg-white/5 border-white/5 opacity-60'}`}>
                                            <div className="flex items-center gap-3 min-w-0 flex-1 pr-3">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${doc.activeForAutofill !== false ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-slate-500'}`}>
                                                    <FileText className="w-4 h-4" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className={`text-xs font-bold truncate ${doc.activeForAutofill !== false ? 'text-slate-200' : 'text-slate-400 line-through'}`}>{doc.name}</p>
                                                    <p className="text-[10px] text-slate-500">{Math.round(doc.content.length / 1000)}k chars • {doc.activeForAutofill !== false ? 'Active for Sparkle' : 'Ignored'}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                                <button 
                                                    onClick={() => toggleDocAutofill(doc.id)}
                                                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${doc.activeForAutofill !== false ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm' : 'bg-white/5 text-slate-400 hover:text-slate-200 border border-white/10'}`}
                                                    title={doc.activeForAutofill !== false ? "Active for Sparkle Autofill. Click to ignore." : "Ignored by Sparkle Autofill. Click to activate."}
                                                >
                                                    <div className={`w-1.5 h-1.5 rounded-full ${doc.activeForAutofill !== false ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                                                    {doc.activeForAutofill !== false ? 'Active' : 'Inactive'}
                                                </button>
                                                <button onClick={() => deleteDoc(doc.id)} className="p-2 text-slate-600 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100" title="Delete document">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e1e2d; border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #2d2d44; }
            `}</style>
        </div>
    );
}