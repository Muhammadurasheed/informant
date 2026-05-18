[Start Here](https://docs.videodb.io/pages/getting-started/welcome)

# Welcome to VideoDB

The perception, memory, and action for AI agents

Copy page

> ## Documentation Index
>
> Fetch the complete documentation index at: [https://docs.videodb.io/llms.txt](https://docs.videodb.io/llms.txt)
>
> Use this file to discover all available pages before exploring further.

Your agents can read text and static images. But the real world is live, continuous, and always changing. To operate with real context, your agent needs real-time access to video calls, camera feeds, screen recordings, and live internet streams.VideoDB is the perception layer that lets agents see, hear, remember, and act on continuous media. Most AI development focuses on text and static images, but video remains a significant hurdle because of its density and lack of structure. VideoDB turns raw pixel data into structured context that agents can query, reason about, and act upon in real time.For agents to move beyond text boxes and interact with the physical or digital world via screens and cameras, they need a way to parse continuous visual and auditory data. VideoDB provides this through a specialized database that indexes video at the scene level - making it possible for an agent to “recall” specific events or “see” real-time occurrences without excessive compute costs.[QuickstartGive your agent perception in 5 minutes](https://docs.videodb.io/pages/getting-started/quickstart)

[Core ConceptsUnderstand the platform architecture](https://docs.videodb.io/pages/core-concepts)

How It Works

The platform operates through three stages:  **See** ,  **Understand** , and  **Act** .| Stage                | What Happens                                                                               |
| ---------------------- | -------------------------------------------------------------------------------------------- |
| **See**        | Capture SDK or live stream integration takes in media from files, desktops, or cameras     |
| **Understand** | Build specialized indexes for transcripts, visual scenes, or custom prompts                |
| **Act**        | Query, search, edit, and export - agents can generate summaries or clips based on findings |

Rather than merely storing video files, the platform indexes frames and audio to support semantic retrieval. This allows an agent to ask for a specific moment in a continuous stream without downloading or processing the entire file.The architecture sits above transport protocols and below the reasoning engine. This separation means you can use VideoDB with any Large Language Model or Large Video Model. By consolidating transcription, frame extraction, vector indexing, and video playback into a single platform, VideoDB addresses the high total cost of ownership typically associated with video AI.### 

Skills: Native Agent Experiences

Since VideoDB handles server-side video processing, indexing, and retrieval, developers can use [skills](https://docs.videodb.io/pages/getting-started/agent-skills) to create agent workflows that feel native to their environment. Skills give agents like Claude Code and Codex structured perception primitives - capture, search, edit, stream - without writing infrastructure code.

```
npx skills add video-db/skills
```

---

What You Can Build

## Desktop Agents

Stream screen, mic, and camera. Get real-time context about what the user is doing and saying.[Call.md →](https://docs.videodb.io/examples-and-tutorials/ai-copilots/call-md)

## Video Search

Search across hours of meetings, lectures, or archives. Get timestamped moments with playable evidence.[Multimodal Search →](https://docs.videodb.io/examples-and-tutorials/video-rag/multimodal-search)

## Real-time Monitoring

Connect RTSP cameras and drones. Detect events as they happen. Trigger alerts and automations.[Intrusion Detection →](https://docs.videodb.io/examples-and-tutorials/live-intelligence/intrusion-detection)

## Media Automation

Compose videos with code. Generate voice, music, and images. Export to any format.[Faceless Video Creator →](https://docs.videodb.io/examples-and-tutorials/content-factory/faceless-video-creator)

## Agent Skills

Add real-time perception to coding assistants and autonomous agents. Screen capture, audio indexing, and searchable context.[Agent Skills →](https://docs.videodb.io/pages/getting-started/agent-skills)

[Browse All ExamplesExplore examples across AI Copilots, Video Search, Live Intelligence, Content Factory, and more](https://docs.videodb.io/examples-and-tutorials)

---

Example: Real-time Alerting

Python

Node.js

```
import videodb

conn = videodb.connect()

# See: Get an active stream (from desktop capture or RTSP)
rtstream = conn.get_rtstream("rts-abc123")

# Understand: Create indexes on the live stream
visual_index = rtstream.index_visuals(prompt="Describe what the user is doing")
audio_index = rtstream.index_audio(prompt="Extract key decisions and action items")

# Act: Create an event and attach an alert
event = conn.create_event(
    event_prompt="Detect when someone mentions a deadline or due date"
)
alert = audio_index.create_alert(
    webhook_url="https://your-backend.com/webhooks/deadline-mentioned"
)

# Real-time events arrive via WebSocket or webhook
# { "channel": "alert", "timestamp": "2026-02-11T12:18:00.968810+00:00", "rtstream_id": "rts-xxx", "rtstream_name": "Meeting", "data": { "event_id": "event-77aae6b981970542", "label": "objection", "triggered": true, "confidence": 0.9, "start": 1770812246.3445818, "end": 1770812277.3488276 } }
```

---

Install the SDK

Python

Node.js

```
pip install videodb
```

[Python SDKGitHub, PyPI, and setup guide](https://docs.videodb.io/pages/getting-started/python)

[Node.js SDKnpm, TypeScript, and setup guide](https://docs.videodb.io/pages/getting-started/node)

---

Philosophy

Why perception is the next frontier for AI agents.[Why AI Agents Are Blind TodayThe gap between human perception and agent perception](https://docs.videodb.io/pages/philosophy/why-agents-are-blind)

[Perception Is the Missing LayerThe stack that gives agents eyes and ears](https://docs.videodb.io/pages/philosophy/perception-is-the-missing-layer)

[MP4 Is the Wrong PrimitiveWhy video files don’t work for AI](https://docs.videodb.io/pages/philosophy/mp4-is-wrong-primitive)

[What Episodic Memory Means for AgentsRemember experiences, not just facts](https://docs.videodb.io/pages/philosophy/episodic-memory-for-agents)

---

[Quickstart](https://docs.videodb.io/pages/getting-started/quickstart)
