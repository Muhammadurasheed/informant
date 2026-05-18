[Start Here](https://docs.videodb.io/pages/getting-started/welcome)

# AI Agent Skills

Add video and audio perception to your AI agents - capture, upload, search, edit, and stream

Copy page

> ## Documentation Index
>
> Fetch the complete documentation index at: [https://docs.videodb.io/llms.txt](https://docs.videodb.io/llms.txt)
>
> Use this file to discover all available pages before exploring further.

Your AI agents can write code and automate tasks brilliantly. But they’re missing one critical capability: the ability to work with video and audio - capturing screens, searching through recordings, editing clips, and streaming results.VideoDB Skills give agents like Claude Code and Codex the power to execute server-side video workflows, turning text-only agents into multimodal collaborators.---

Install VideoDB Skills

Get video and audio perception in your agent with one command:* NPX (Recommended)

* Claude Code Plugin

```
npx skills add video-db/skills
```

Then run `/videodb setup` to configure your API key and verify connectivity.[VideoDB Skills on GitHubComplete source code, installation guide, and configuration examples](https://github.com/video-db/skills)

---

Prerequisites

1

[](https://docs.videodb.io/pages/getting-started/agent-skills#)

VideoDB API Key

Get a free API key from [console.videodb.io](https://console.videodb.io/)No credit card required. Free tier includes 50 uploads.

2

[](https://docs.videodb.io/pages/getting-started/agent-skills#)

System Requirements

* **Python 3.9+**
* **Platform** : macOS, Linux, Windows (PowerShell)

3

[](https://docs.videodb.io/pages/getting-started/agent-skills#)

Set Your API Key

Export your API key in your shell:

```
export VIDEO_DB_API_KEY=your-key-here
```

Or add it to a `.env` file in your project root.

---

What It Does

VideoDB Skills is a perception capability that enables  **See → Understand → Act, as an API, for video and audio** . It gives agents like Claude Code, Codex, and Cursor the ability to execute server-side video workflows.One unified interface for:* **See** - Capture desktop screens, microphone/system audio, RTSP streams, and ingest files, URLs, and YouTube content

* **Understand** - Visual analysis, transcription, indexing, and searching moments with playable clips
* **Act** - Stream results, trigger alerts, edit timelines, generate subtitles/overlays, and export clips

Why Use It

* Video Workflows
* Real-Time Perception
* Search & Intelligence

Execute video operations without local ffmpeg installation:* Upload from YouTube, URLs, or local files

* Trim, merge, clip, overlay text/images/audio
* Transcode, reframe, adjust resolution and aspect ratio
* Get instant playable HLS links via built-in CDN

Quick Start

Ask your agent to execute video tasks:

```
Upload [YouTube URL] and provide a shareable stream link
```

```
Extract clips from 10s-30s and 45s-60s and merge them
```

```
Generate background music and add to this clip
```

```
Add white text on black background subtitles to the original video
```

```
Capture my screen for two minutes and report my activities with insights
```

```
Monitor my IP Camera RTSP stream and log person detection alerts with timestamps
```

Capabilities

| Capability                  | What It Does                                                          |
| --------------------------- | --------------------------------------------------------------------- |
| **Capture**           | Desktop screen, microphone, and system audio for real-time processing |
| **Upload**            | Ingest from YouTube, URLs, or local files                             |
| **Context**           | Generate structured context from RTSP feeds or desktop streams        |
| **Search**            | Locate moments by speech, scenes, or metadata with playable evidence  |
| **Transcripts**       | Generate timestamped transcripts                                      |
| **Subtitles**         | Auto-generate, style, and burn-in subtitles                           |
| **Edit**              | Trim, merge, clip, overlay text/images/audio; add dubbing/translation |
| **AI Generate**       | Create images, video, music, sound effects, voiceovers                |
| **Transcode/Reframe** | Adjust resolution, quality, aspect ratio, social crops server-side    |
| **Stream**            | Obtain instant playable HLS links via built-in CDN                    |

---

Example: OpenClaw Monitoring

VideoDB Skills powers [OpenClaw Monitoring](https://github.com/video-db/openclaw-monitoring) - “CCTV for AI agents” that monitors, records, and audits autonomous agent sessions. Every agent run becomes a live stream, replayable recording, and searchable archive.[OpenClaw Monitoring on GitHubSee how VideoDB Skills enables visual observability for autonomous agents](https://github.com/video-db/openclaw-monitoring)

---

Next Steps

[Capture SDK OverviewDeep dive: channels, permissions, client code, and event handling](https://docs.videodb.io/pages/ingest/capture-sdks/overview)

[Real-time ContextHow real-time indexing and search works](https://docs.videodb.io/pages/ingest/capture-sdks/realtime-context)

[AI Copilot ExamplesExplore more AI copilot projects and use cases](https://docs.videodb.io/examples-and-tutorials/ai-copilots)

[QuickstartTry desktop perception with a hosted OpenClaw agent](https://docs.videodb.io/pages/getting-started/quickstart)

[Node.js SDK v0.2.0 Migration](https://docs.videodb.io/pages/getting-started/node-migration)[Core Concepts in 5 Minutes](https://docs.videodb.io/pages/getting-started/core-concepts-in-5-min)

[x](https://x.com/videodb_io)[github](https://github.com/video-db)[linkedin](https://www.linkedin.com/company/videodb)

# Core Concepts in 5 Minutes

The entire VideoDB mental model in one scroll - perception, memory, and action for AI agents.

Copy page

> ## Documentation Index
>
> Fetch the complete documentation index at: [https://docs.videodb.io/llms.txt](https://docs.videodb.io/llms.txt)
>
> Use this file to discover all available pages before exploring further.

The Problem

AI agents can reason about text brilliantly. But show them a 30-minute meeting recording and ask “what did the client say about pricing?” - they fail.Video files are opaque blobs. Your agent can’t query them, can’t search them, can’t get timestamped answers from them.## 

The Platform Loop

Every VideoDB workflow follows the same pattern:

```
See → Understand → Act
```

| Stage                | What Happens                                   | Returns                                        |
| -------------------- | ---------------------------------------------- | ---------------------------------------------- |
| **See**        | Ingest from files, streams, or desktop capture | `Video`, `RTStream`, or `CaptureSession` |
| **Understand** | Create indexes. Search with natural language.  | Timestamped moments with playable evidence     |
| **Act**        | Trigger alerts. Compose edits. Export streams. | Webhooks, playable URLs, downloadable files    |

Quick Example

```
import videodb

conn = videodb.connect()

# SEE: Ingest
coll = conn.get_collection()
video = coll.upload(url="https://example.com/meeting.mp4")

# UNDERSTAND: Index and search
video.index_spoken_words()
results = video.search("pricing discussion")

# ACT: Use the results
for shot in results.shots:
    print(f"{shot.start}s - {shot.end}s: {shot.text}")
    shot.play()  # Playable proof
```

---

See: Three Input Types

| Source                    | Method                               | Returns                            |
| ------------------------- | ------------------------------------ | ---------------------------------- |
| **Files**           | `coll.upload(url="...")`           | `Video`                          |
| **Live streams**    | `conn.connect_rtstream(url="...")` | `RTStream`                       |
| **Desktop capture** | `conn.create_capture_session(...)` | `CaptureSession` → `RTStream` |

```
# Files
coll = conn.get_collection()
video = coll.upload(url="https://youtube.com/watch?v=...")

# Live RTSP
rtstream = conn.connect_rtstream(url="rtsp://camera.local/stream")

# Desktop capture
cap = conn.create_capture_session(end_user_id="user_123")
```

Same APIs work downstream. Index a `Video` or an `RTStream` the same way.---

Understand: Indexes Are Everything

Indexes are what transform opaque media into searchable knowledge. You create them with prompts.### 

Spoken Index

Transcribes audio and makes it searchable:

```
video.index_spoken_words()
# or for live:
rtstream.start_transcript()
```

Visual Index

Understands what’s happening on screen:

```
video.index_visuals(prompt="Describe key activities and events")
# or for live:
rtstream.index_visuals(prompt="Describe what user is doing")
```

Multiple Indexes

Create different perspectives on the same media:

```
# Same video, different questions
safety_index = video.index_visuals(prompt="Identify safety violations")
summary_index = video.index_visuals(prompt="Summarize each segment")
```

Indexes are additive. Add new ones without reprocessing. Remove old ones without affecting others.---

Search Returns Evidence

Search returns timestamps and playable links - not just “found” but verifiable.

```
results = video.search("product demo")

for shot in results.shots:
    print(f"{shot.start}s - {shot.end}s")  # Timestamps
    print(f"Content: {shot.text}")         # What was found
    print(f"Score: {shot.search_score}")   # Relevance
    shot.play()                            # Play it to verify
```

Every result maps to a playable moment. Your agent can cite its sources.---

Act: Events, Alerts, Editing

Trigger on conditions

```
# Create a reusable event
event_id = conn.create_event(
    event_prompt="Detect when someone mentions 'budget'",
    label="budget_mention"
)

# Wire it to an index
index.create_alert(event_id=event_id, callback_url="https://...")
```

Compose with code

```
from videodb.editor import Timeline, Track, Clip, VideoAsset

timeline = Timeline(conn)
track = Track()
track.add_clip(0, Clip(asset=VideoAsset(id=video.id), duration=30))
timeline.add_track(track)

stream_url = timeline.generate_stream()
```

---

Objects at a Glance

| Object           | What It Represents              |
| ---------------- | ------------------------------- |
| `Connection`   | Your authenticated session      |
| `Collection`   | Container for organizing media  |
| `Video`        | Uploaded video                  |
| `RTStream`     | Live stream (RTSP or capture)   |
| `Index`        | Searchable interpretation layer |
| `SearchResult` | Query results with shots        |
| `Shot`         | Single timestamped match        |
| `Event`        | Reusable detection rule         |
| `Alert`        | Event + delivery config         |
| `Timeline`     | Programmatic edit composition   |

---

Next Steps

[QuickstartTry it hands-on](https://docs.videodb.io/pages/getting-started/quickstart)

[Core Concepts (Full)Deep dive with examples](https://docs.videodb.io/pages/core-concepts/overview)

[Data ModelAll objects and relationships](https://docs.videodb.io/pages/core-concepts/data-model)

[Indexes &amp; SearchHow indexing and retrieval work](https://docs.videodb.io/pages/core-concepts/indexes-and-search)

[AI Agent Skills](https://docs.videodb.io/pages/getting-started/agent-skills)[Core Concepts Overview](https://docs.videodb.io/pages/core-concepts/overview)

[x](https://x.com/videodb_io)[github](https://github.com/video-db)[linkedin](https://www.linkedin.com/company/videodb)[discord](https://discord.com/invite/py9P639jGz)
