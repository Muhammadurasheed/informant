End-to-End User Journey — Rasheed as Persona
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

