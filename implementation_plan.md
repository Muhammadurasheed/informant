🔬 Informant vs VideoDB Hackathon: Surgical Analysis & Re-Architecture
TL;DR — The Blunt Verdict
CAUTION

The current Informant codebase is a ScholarStream fork with a text-scraping copilot that has ZERO meaningful VideoDB integration. The videodb_service.py is a skeleton with placeholder comments like # TODO: Once the session is closed, stitch and upload to VideoDB. The copilot_service.py is entirely text-based with Gemini prompts — no video, no audio, no perception. As-is, this would be disqualified or score near-zero on "Depth of VideoDB usage" (30% of judging).

IMPORTANT

But the CONCEPT is brilliant and maps perfectly to what the hackathon is asking for. The hackathon literally lists "Second brain" and "Meeting or workflow memory" as inspiration categories. Informant IS a second brain for browsing. The problem is purely in execution — we need to rip out the text-scraping approach and replace it with VideoDB's RTStream/CaptureSession as the perception and memory backbone.

Part 1: Hackathon Requirements Decomposition
🔴 Mandatory Technical Requirements (Pass/Fail Gate)
#	Requirement	Source	Status in Current Codebase
1	Use CaptureSession / RTStream to capture screen, audio, camera, or agent activity during a live session	Lines 33-34	❌ videodb_service.py has placeholder create_capture_session() but no actual RTStream connection, no RTSP streams, no connect_rtstream()
2	Use Search / Memory / Context — convert captures to context, search what agent saw/heard	Lines 36-37	❌ search_memory() returns empty list [] with comment # This is a placeholder
3	Working demo (video walkthrough or live link)	Line 91	❌ Not yet built
4	Public GitHub repository	Line 92	✅ Repo exists
5	200-word description	Line 93	❌ Not yet written
6	Submitted before May 18, 10:00 AM IST	Line 94	⏳ ~44 hours remaining
🟡 Judging Criteria (What Wins)
Criteria	Weight	What Judges Want	Current Score
Technical Execution	40%	Clean code, working product, proper architecture	🟡 3/10 — the FastAPI/Chrome Extension scaffold is solid but nothing actually works end-to-end
Creativity & Originality	30%	Novel use case, unique angle	🟢 8/10 — "Browser co-pilot that remembers everything you browsed" is genuinely creative and maps to the "Second Brain" inspiration
Depth of VideoDB Usage	30%	Meaningful use of capture, indexing, search, streaming APIs	🔴 0/10 — Zero actual VideoDB API calls execute. Everything is text/Gemini.
🟢 What the Hackathon Is REALLY Asking For
The hackathon theme is:

"Build anything that shows what becomes possible when agents have eyes and ears."

The key primitives are:

See → RTStream.connect_rtstream() + index_visuals() — the agent sees the screen
Hear → RTStream.start_transcript() + index_audio() — the agent hears audio
Remember → Indexed data becomes searchable context via video.search() / rtstream.search() / coll.search()
Act → Use search results to take action (answer questions, fill forms, trigger alerts)
Part 2: Blunt Gap Analysis — What Fits and What Doesn't
✅ What Fits Perfectly (Don't Change This)
Informant Feature	Hackathon Alignment
Browser extension as the delivery mechanism	Perfect — it's where users browse, natural UX
"Sees everything you see" concept	Maps 1:1 to CaptureSession screen capture
"Remembers everything" concept	Maps 1:1 to VideoDB indexing + search
Natural language recall ("remind me the deadline")	Maps 1:1 to video.search(query)
Side panel chat interface	Great UX for an agentic co-pilot demo
❌ What Does NOT Fit (Must Be Cut or Reworked)
Feature	Problem	Recommendation
Text-scraping page content via DOM	The hackathon requires VIDEO/AUDIO perception, not DOM scraping. Judges are technical builders who will immediately see this is a text copilot pretending to have "eyes"	REPLACE: Use RTStream.index_visuals() to capture what's on-screen as video, not DOM text
PDF upload + document parsing	Cool feature, but adds zero VideoDB depth. It's pure Gemini text processing	DEPRIORITIZE: Keep as a stretch goal but don't feature it in the demo
Sparkle auto-fill from text documents	Again, pure text. No video/audio perception involved	RETHINK: Auto-fill should pull from VideoDB search results (visual memory of what the user browsed)
Platform-specific personas (DevPost, DoraHacks, etc.)	Over-engineered text feature that adds no hackathon value	CUT ENTIRELY
⚠️ The Dangerous Misalignment
WARNING

The current architecture treats the browser page content as TEXT to be scraped. The hackathon wants you to treat the browser as a VISUAL STREAM to be captured, indexed, and searched. These are fundamentally different architectures.

Current: Extension scrapes DOM → sends text to Gemini → Gemini responds
Required: Extension captures screen → sends to VideoDB RTStream → VideoDB indexes visuals + audio → user queries search the indexed video memory → VideoDB returns timestamped, playable evidence
Part 3: The Re-Architected Informant
Core Philosophy Shift
BEFORE: Informant = Text Scraper + LLM Chat
AFTER:  Informant = VideoDB Visual Memory + Natural Language Recall
Architecture
User Interaction
Informant Backend
VideoDB Cloud
Chrome Extension
Content Script
Screen Capture via chrome.tabCapture / getDisplayMedia
MediaRecorder - WebM chunks
Background Service Worker
RTSP/WebRTC → VideoDB RTStream
RTStream - Live Screen
index_visuals - Scene Indexing
index_audio - Audio Indexing
start_transcript - Live Transcript
Searchable Visual Memory
FastAPI
VideoDB SDK
Search Results with Timestamps
Gemini AI - Synthesize Answer
Side Panel Chat
Playable Evidence Links
The Three Pillars
Pillar	VideoDB Feature	Informant UX
SEE	connect_rtstream() + index_visuals()	Extension captures screen as video stream, VideoDB indexes what's on screen every 30 seconds
REMEMBER	search() across indexed RTStream	"What was the deadline for DIV Fund?" → searches visual memory + transcripts
ACT	Search results + Gemini synthesis	Returns answer with specific timestamps and playable video clips of the exact moment
Part 4: End-to-End User Journey — Rasheed as Persona
Persona: Rasheed
Role: Nigerian software engineer applying for grants and hackathons
Pain point: Browses 20+ opportunity pages daily, forgets details, deadlines, and requirements
Goal: Never lose information from any page he visits
Scene 1: Installation & First Launch (0:00 - 0:30)
Rasheed installs the Informant Chrome extension from a .crx file (or loads unpacked for demo).

Rasheed clicks the extension icon → the side panel opens
He sees a clean, dark-themed UI with the Informant logo
A welcome message: "Assalamunaleikum! I'm Informant — I see everything you browse and remember it all. Click ▶ Start Session to give me eyes."
A prominent "▶ Start Session" button
Technical Flow:

Extension renders SidePanel → WelcomeView component
No VideoDB calls yet — just UI
Scene 2: Starting a Capture Session (0:30 - 1:00)
Rasheed clicks "▶ Start Session"

Chrome prompts: "Informant wants to share your screen" → Rasheed selects his current Chrome tab
The side panel shows a pulsing 🔴 dot: "Session Live — I'm watching and remembering..."
A small floating badge appears in the corner of the page: 🔴 INFORMANT RECORDING
Technical Flow:

python
# Backend: POST /api/session/start
conn = videodb.connect(api_key=VIDEODB_API_KEY)
coll = conn.get_collection()
# Connect the screen stream from extension's MediaRecorder output
screen_stream = coll.connect_rtstream(
    url=screen_rtsp_url,  # Extension streams to RTSP relay
    name=f"rasheed_browsing_{timestamp}",
    media_types=["video"]
)
# Start visual indexing — THIS IS THE KEY VIDEODB INTEGRATION
screen_stream.index_visuals(
    prompt="Describe the webpage content: page title, key text, deadlines, requirements, form fields, links, and any important details visible on screen. Note the current URL.",
    batch_config={"type": "time", "value": 30, "frame_count": 5},
    ws_connection_id=ws.connection_id
)
# Start audio indexing (if user has mic/tab audio)
screen_stream.index_audio(
    prompt="Summarize any spoken content, video narration, or audio from the page.",
    batch_config={"type": "time", "value": 30},
    ws_connection_id=ws.connection_id
)
Scene 3: Browsing the DIV Fund Grant Page (1:00 - 3:00)
Rasheed navigates to the DIV Fund Proposal Grant platform. He scrolls through the page reading requirements, eligibility criteria, deadlines, and funding amounts.

He reads the page naturally — scrolling through sections on eligibility, funding tiers ($25K-$200K), application requirements, deadline (July 15, 2026), required documents
In the side panel, subtle visual feedback shows: 📸 Page indexed (3 snapshots) as VideoDB processes his screen
He spends ~2 minutes reading, then navigates away to check another grant
Technical Flow:

Every 30 seconds, VideoDB captures 5 frames from the screen stream
index_visuals() processes each batch with the configured prompt
The visual index now contains entries like:
json
{
  "type": "index",
  "index_type": "visual", 
  "text": "User is viewing divfund.org/apply - Grant page showing: Eligibility: registered NGOs, research institutions, and social enterprises. Funding tiers: Stage 1 ($25K-$200K), Stage 2 ($200K-$1.5M). Deadline: July 15, 2026. Required documents: organizational profile, theory of change, budget template, proof of registration."
}
Scene 4: Browsing More Pages (3:00 - 5:00)
Rasheed visits 3 more pages:

A hackathon on DevPost (prizes, submission requirements, tech stack)
A scholarship opportunity (GPA requirements, essay prompts)
A job posting (skills needed, salary range, application deadline)
Each page is automatically captured and indexed by VideoDB. Rasheed does nothing special — just browses normally.

Scene 5: THE MIND-BLOWN MOMENT — Memory Recall (5:00 - 7:00)
30 minutes later, Rasheed can't remember the DIV Fund deadline. He opens the Informant side panel.

Rasheed types in the chat: "Hi Informant, remind me the minimum requirements for the DIV Fund proposal grant and when is the deadline again?"

The side panel shows a thinking animation: 🔍 Searching your visual memory...

Informant responds:

📋 DIV Fund Proposal Grant — From Your Browsing Memory

Deadline: July 15, 2026

Minimum Requirements:

Registered NGO, research institution, or social enterprise
Theory of change document
Organizational profile
Budget template (use their provided template)
Proof of registration in country of operation
Funding: Stage 1 grants range $25,000 - $200,000

🎬 
View the exact moment you saw this →

The playable evidence link opens a VideoDB stream URL showing the exact frame from Rasheed's browsing session where the deadline was visible. This is the "blown your mind" moment.

Technical Flow:

python
# Backend: POST /api/memory/search
@router.post("/api/memory/search")
async def search_memory(request: SearchRequest):
    conn = videodb.connect(api_key=VIDEODB_API_KEY)
    coll = conn.get_collection()
    
    # Search across ALL indexed visual + audio content
    results = coll.search(
        query=request.query,  # "minimum requirements DIV Fund deadline"
        index_type=["scene", "spoken_word"]
    )
    
    # Extract relevant shots with timestamps
    evidence = []
    for shot in results.shots:
        evidence.append({
            "text": shot.text,
            "timestamp": shot.start,
            "confidence": shot.search_score,
            "playback_url": shot.generate_stream()  # PLAYABLE VIDEO EVIDENCE
        })
    
    # Send to Gemini to synthesize a human-friendly answer
    synthesis_prompt = f"""
    User asked: {request.query}
    
    Visual memory evidence:
    {json.dumps(evidence, indent=2)}
    
    Synthesize a concise, accurate answer using ONLY the evidence above.
    Include the most relevant playback URL as a citation.
    """
    
    answer = await gemini.generate(synthesis_prompt)
    
    return {
        "answer": answer,
        "evidence": evidence,  # Playable video clips
        "sources_count": len(evidence)
    }
Scene 6: Application Form Auto-Fill (7:00 - 9:00) — STRETCH GOAL
Rasheed navigates to the DIV Fund application form. He wants help filling it out.

Rasheed types: "Help me fill out this application form using what you know about me and what I browsed."

Informant searches VideoDB memory for context about Rasheed's background AND the DIV Fund requirements

Using the search results + Gemini, it generates field-specific content

Sparkle icons appear on form fields — clicking them auto-fills based on visual memory

This feature is a STRETCH GOAL — the core demo is Scenes 1-5.

Part 5: Technical Implementation Plan
What Must Be Built in 48 Hours
Priority 1: MUST HAVE (Core Demo — 70% of time)
Component	Work	Time Est.
Screen Capture in Extension	Use chrome.tabCapture.capture() or navigator.mediaDevices.getDisplayMedia() to get video stream. Use MediaRecorder to chunk into WebM segments. Send chunks to backend via WebSocket/HTTP	4-5 hours
RTSP Relay / RTStream Connection	Backend receives chunks and pipes them to VideoDB RTStream. Alternatively, use VideoDB's browser-side capture SDK if available	3-4 hours
Visual Indexing Pipeline	Configure index_visuals() with a prompt optimized for web page content extraction. Batch every 30 seconds, 5 frames per batch	2-3 hours
Search/Recall Endpoint	POST /api/memory/search — calls coll.search() with user's natural language query, returns timestamped results with playable evidence	2-3 hours
Gemini Answer Synthesis	Take VideoDB search results, synthesize human-friendly answer with evidence citations	2 hours
Side Panel UI — Session Control	Start/stop session button, recording indicator, chat interface for querying memory	3-4 hours
Side Panel UI — Recall Display	Show synthesized answer + playable evidence links + timestamp citations	2-3 hours
Subtotal: ~18-22 hours

Priority 2: SHOULD HAVE (Polish — 20% of time)
Component	Work	Time Est.
Audio Indexing	Add index_audio() for tab audio (if user plays videos on the page)	2 hours
Session History	List of past sessions with search across all of them	2 hours
Real-time indexing feedback	Show what VideoDB indexed via WebSocket events in the side panel	2 hours
Subtotal: ~6 hours

Priority 3: NICE TO HAVE (Stretch — 10% of time)
Component	Work	Time Est.
Document Upload	Upload PDFs as videos to a VideoDB collection for search	2 hours
Form Auto-fill	Use memory search + Gemini to auto-fill detected form fields	3 hours
What Must Be DELETED or GUTTED
WARNING

These components from the current codebase must be removed or heavily refactored — they add zero hackathon value and could confuse judges about what the product actually does.

Component	Action
copilot_service.py — Platform Personas (DevPost, DoraHacks, etc.)	DELETE — replace with generic memory-search chatbot
copilot_service.py — Sparkle V4 field generation	KEEP but rewire — should pull from VideoDB search results, not just text documents
models.py — ScholarStream-specific models (DeepUserProfile, Project, etc.)	SIMPLIFY — replace with Session and MemoryQuery models
DOM text scraping in content script	REPLACE — with screen capture MediaRecorder
All references to "ScholarStream"	RENAME to Informant
Part 6: The Critical Screen-Capture Architecture Decision
IMPORTANT

This is the single most important technical decision for the hackathon. How does the browser extension's screen capture reach VideoDB's RTStream?

Option A: Backend RTSP Relay (Recommended for 48-hour hackathon)
Extension → MediaRecorder (WebM chunks) → WebSocket → Backend → FFmpeg RTSP relay → VideoDB RTStream
Pros: Full control, works with connect_rtstream(url=rtsp_url)
Cons: Requires FFmpeg on the backend server, slight latency

Option B: Direct Upload + Index (Simpler, Less Real-Time)
Extension → MediaRecorder (WebM chunks) → HTTP POST → Backend → coll.upload(file_path) → video.index_visuals()
Pros: Much simpler, no RTSP needed
Cons: Not real-time, batch processing, misses the "live capture" aspect. But still uses VideoDB indexing + search.

Option C: Browser-to-VideoDB Direct (If SDK Supports)
Extension → VideoDB JavaScript SDK → RTStream directly
Pros: Cleanest architecture
Cons: Unclear if VideoDB has a browser-compatible JS SDK for RTStream

Recommendation
Start with Option B (upload + index), pivot to Option A if time permits. Option B guarantees a working demo with meaningful VideoDB usage. Option A is more impressive but riskier in 48 hours.

Part 7: 48-Hour Execution Timeline
Block	Time	Focus
Block 1 (Hours 0-6)	Sat 10:00 AM - 4:00 PM IST	Claim credits, set up VideoDB SDK, test upload() + index_visuals() + search() in a Jupyter notebook. Prove the core pipeline works.
Block 2 (Hours 6-14)	Sat 4:00 PM - Midnight IST	Build screen capture in Chrome extension. MediaRecorder → WebM chunks → POST to backend. Backend receives + uploads to VideoDB.
Block 3 (Hours 14-22)	Sun 12:00 AM - 8:00 AM IST	Build the recall system: search endpoint + Gemini synthesis + playable evidence links. Wire to side panel UI.
Block 4 (Hours 22-30)	Sun 8:00 AM - 4:00 PM IST	Polish UI: start/stop session, recording indicator, chat UX, recall display with evidence.
Block 5 (Hours 30-40)	Sun 4:00 PM - 2:00 AM Mon IST	End-to-end testing, bug fixing, audio indexing (stretch), session history (stretch).
Block 6 (Hours 40-48)	Mon 2:00 AM - 10:00 AM IST	Record demo video, write 200-word description, clean up GitHub repo, submit.
Part 8: The 200-Word Description (Draft)
Informant is a browser-based AI co-pilot that gives agents eyes and ears over your browsing sessions.

When activated, Informant continuously captures your browser screen via VideoDB's RTStream, indexing every page you visit — visuals, text, deadlines, requirements — into searchable memory. Unlike bookmarks or note-taking, Informant remembers everything you saw, automatically.

The magic: ask Informant anything you browsed. "What was the deadline for that grant?" or "What were the technical requirements on that hackathon page?" Informant searches your indexed visual memory using VideoDB's semantic search, retrieves the exact moment you saw the information, and returns a synthesized answer with playable video evidence — you can literally watch the recording of yourself reading that page.

VideoDB Usage: CaptureSession/RTStream for live screen capture, index_visuals() for scene-level visual indexing of web pages, index_audio() for tab audio, coll.search() for natural language recall across all browsing sessions, and playable evidence streams for verifiable citations.

Built as a Chrome Extension + FastAPI backend. Your browser becomes your second brain — one that never forgets.

Open Questions
IMPORTANT

Q1: Screen Capture Method — Should we use chrome.tabCapture (captures only the active tab, cleaner) or getDisplayMedia (captures full screen, broader but noisier)? I recommend chrome.tabCapture for focused, per-tab capture.

IMPORTANT

Q2: Upload vs RTStream — Given the 48-hour constraint, do you want to go with the simpler upload-then-index approach (Option B), or attempt the real-time RTStream relay (Option A)? Option B is safer.

IMPORTANT

Q3: Scope Cut Confirmation — Are you okay with cutting the PDF upload/document parsing feature from the MVP demo? We can mention it as "future work" in the description but not demo it. The demo should be laser-focused on the video memory → recall loop.

IMPORTANT

Q4: Audio — Should we capture tab audio (for pages with video/audio content)? This adds index_audio() usage but requires additional permissions and complexity.

Verification Plan
Automated Tests
VideoDB Pipeline Test: Upload a sample screen recording → index_visuals → search("deadline") → verify results contain expected text
Extension Capture Test: Start capture → navigate to a test page → verify WebM chunks are generated and sent to backend
End-to-End Test: Capture session → browse 2-3 pages → stop → search for content from each page → verify recall accuracy
Manual Verification (Demo Script)
Install extension → start session → browse 3 different pages (grant, hackathon, job posting)
Stop session → ask Informant about details from each page
Verify answers are accurate and include playable evidence links
Record the entire demo as a screen recording for submission
