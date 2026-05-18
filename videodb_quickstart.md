[Start Here](https://docs.videodb.io/pages/getting-started/welcome)

# Quickstart

Give your AI agent eyes and ears in 5 minutes

Copy page

> ## Documentation Index
>
> Fetch the complete documentation index at: [https://docs.videodb.io/llms.txt](https://docs.videodb.io/llms.txt)
>
> Use this file to discover all available pages before exploring further.

Your agent can reason about text. Now give it the ability to perceive - screen, microphone, camera, and video files.## 

Get Your API Key

1. Go to [VideoDB Console](https://console.videodb.io/)
2. Copy your API key (free tier: 50 uploads, no credit card)
3. Set it in your environment:

```
export VIDEODB_API_KEY="your-api-key"
```

Install the SDK or Skill

Python

Node.js

```
pip install videodb
```

For agents like Claude Code, Codex, or Cursor:

```
npx skills add video-db/skills
```

---

Real-time Perception (Desktop Capture)

Stream what your agent sees and hears. Get structured context back in real-time.

Desktop capture currently supports **macOS** and  **Windows** .

To help you understand desktop perception in under a minute, before you install the SDK, we’ve hosted a live desktop running our **OpenClaw** agent. Its screen and microphone are streaming into VideoDB, where we generate structured context in real time. Here’s the live feed of that agent

<iframe allow="autoplay; encrypted-media" allowfullscreen="" src="https://matrix.videodb.io/" class=""></iframe>

This is the same workflow you’ll use with your own agents and your own desktop — real-time visual and audio context, out of the box.

What You Get

Your backend receives AI-ready events in real-time:

```
{"type": "transcript", "text": "Let's schedule the meeting for Thursday", "is_final": true}
```

```
{"type": "index", "index_type": "visual", "text": "User is viewing a Slack conversation with 3 unread messages"}
```

```
{"type": "index", "index_type": "audio", "text": "Discussion about scheduling a team meeting"}
```

```
{"type": "alert", "label": "sensitive_content", "triggered": true, "confidence": 0.92}
```

Now, It’s Your Turn

Use the code below to connect to our OpenClaw’s live visual and audio feeds, get real-time context, define events, and create alerts. You’ll receive transcript updates and structured screen context in your WebSocket listener, plus you can attach event rules for alerts.Python

Node.js

```
import asyncio
import signal
import videodb
from dotenv import load_dotenv

load_dotenv()

AUDIO_URL = "rtsp://matrix.videodb.io:8554/audio"
SCREEN_URL = "rtsp://matrix.videodb.io:8554/screen"


async def main():
    conn = videodb.connect()
    coll = conn.get_collection()
    print(f"connected to collection: {coll.id}")

    ws = conn.connect_websocket()
    ws = await ws.connect()

    # Connect streams
    audio = coll.connect_rtstream(url=AUDIO_URL, name="Audio", media_types=["audio"])
    screen = coll.connect_rtstream(url=SCREEN_URL, name="Screen", media_types=["video"])
    print(f"audio stream:  {audio.id} ({audio.status})")
    print(f"screen stream: {screen.id} ({screen.status})")

    # Start pipelines
    audio.start_transcript(ws_connection_id=ws.connection_id)
    print("transcript started")

    audio.index_audio(
        prompt="Summarize what is being said or heard.",
        batch_config={"type": "time", "value": 30},
        ws_connection_id=ws.connection_id,
    )
    print("audio indexing started (30s window)")

    screen.index_visuals(
        prompt="In one sentence, describe the active application and what the agent is doing on screen. Note the current time if a clock is visible.",
        batch_config={"type": "time", "value": 30, "frame_count": 5},
        ws_connection_id=ws.connection_id,
    )
    print("visual indexing started (30s window, 5 frames)")

    # Listen for events — Ctrl+C to stop
    print("\nlistening for events...\n")
    stop = asyncio.Event()
    for sig in (signal.SIGINT, signal.SIGTERM):
        asyncio.get_event_loop().add_signal_handler(sig, stop.set)

    async def listen():
        async for msg in ws.receive():
            ch = msg.get("channel", "?")
            if ch == "capture_session":
                continue
            data = msg.get("data", msg)
            if ch == "transcript" and not data.get("is_final", False):
                continue
            text = data.get("text", "") if isinstance(data, dict) else ""
            print(f"  [{ch}] {text}")

    task = asyncio.create_task(listen())
    await asyncio.wait([task, asyncio.create_task(stop.wait())], return_when=asyncio.FIRST_COMPLETED)
    task.cancel()

    # Cleanup
    print("\nstopping streams...")
    audio.stop()
    screen.stop()
    await ws.close()
    print("done.")


if __name__ == "__main__":
    asyncio.run(main())
```

Try the interactive quickstart: [Real-time Perception Quickstart on GitHub](https://github.com/video-db/videodb-capture-quickstart/blob/main/examples/openclaw-monitoring/try_without_setup.py)

[Full Capture GuideDeep dive: channels, permissions, client code, and event handling](https://docs.videodb.io/pages/ingest/capture-sdks/overview)

---

Working with Video Files

Upload, index, and search existing recordings.### 

Upload a video

Python

Node.js

```
import videodb

conn = videodb.connect()
coll = conn.get_collection()
video = coll.upload(url="https://www.youtube.com/watch?v=WDv4AWk0J3U")

# Get an embeddable stream URL
stream_url = video.generate_stream()
print(stream_url)  # HLS link you can embed anywhere
```

Upload from YouTube, S3, any public URL, or local files.### 

Update video metadata

Python

Node.js

```
video.update(name="New Video Title")
```

Index spoken words

Create a searchable transcript:Python

Node.js

```
video.index_audio(prompt="Extract key topics, decisions, and action items")
```

Search with natural language

Python

Node.js

```
results = video.search("What are the key benefits?")

for shot in results.shots:
    print(f"{shot.start}s - {shot.end}s: {shot.text}")

# Play the matching moments
results.play()
```

Search returns timestamps and playable links - verifiable evidence your agent can use.---

Index Visual Scenes

For video where visuals matter (security footage, tutorials, presentations):Python

Node.js

```
# Index with a prompt describing what to look for
video.index_visuals(prompt="Identify key moments and activities")

# Search visual content
results = video.search("person entering the room", index_type="scene")
results.play()
```

---

Search Across Collections

Scale to thousands of videos:Python

Node.js

```
# Get your collection
coll = conn.get_collection()

# Upload multiple videos
coll.upload(url="https://youtube.com/watch?v=video1")
coll.upload(url="https://youtube.com/watch?v=video2")
coll.upload(url="https://youtube.com/watch?v=video3")

# Index all
for video in coll.get_videos():
    video.indexAudio()

# Search across everything
results = coll.search("quarterly revenue discussion")
results.play()  # Plays matching moments from any video
```

---

What’s Next

[Core Concepts in 5 MinThe mental model: See → Understand → Act](https://docs.videodb.io/pages/getting-started/core-concepts-in-5-min)

[Ingesting FilesUpload videos, audio, and images from URLs or local files](https://docs.videodb.io/pages/ingest/files-and-collections/upload-video)

[RTSP IngestConnect live camera streams and feeds](https://docs.videodb.io/pages/ingest/live-streams/rtsp-ingest)

[Create an IndexMake your media searchable with indexes](https://docs.videodb.io/pages/understand/indexing-pipelines/create-an-index)

[Welcome to VideoDB](https://docs.videodb.io/pages/getting-started/welcome)[Python SDK](https://docs.videodb.io/pages/getting-started/python)

[x](https://x.com/videodb_io)[github](https://github.com/video-db)[linkedin



](https://www.linkedin.com/company/videodb)

[Start Here](https://docs.videodb.io/pages/getting-started/welcome)

[SDK Installation](https://docs.videodb.io/pages/getting-started/python)

# Python SDK

Install and configure the VideoDB Python SDK

Copy page

> ## Documentation Index
>
> Fetch the complete documentation index at: [https://docs.videodb.io/llms.txt](https://docs.videodb.io/llms.txt)
>
> Use this file to discover all available pages before exploring further.

Installation

```
pip install videodb
```

[PyPIView package on PyPI](https://pypi.org/project/videodb/)

[GitHubSource code and issues](https://github.com/video-db/videodb-python)

Quick Start

```
import videodb

# Connect using environment variable
conn = videodb.connect()

# Or pass API key directly
conn = videodb.connect(api_key="your-api-key")
```

Environment Variables

| Variable            | Description                                                     |
| ------------------- | --------------------------------------------------------------- |
| `VIDEODB_API_KEY` | Your API key from[console.videodb.io](https://console.videodb.io/) |

```
export VIDEODB_API_KEY="your-api-key"
```

Requirements

* Python 3.8 or higher
* Works on Linux, macOS, and Windows

Basic Usage

```
import videodb

conn = videodb.connect()

# Upload a video
coll = conn.get_collection()
video = coll.upload(url="https://www.youtube.com/watch?v=example")

# Index for search
video.index_spoken_words()

# Search with natural language
results = video.search("key moments")
for shot in results.shots:
    print(f"{shot.start}s: {shot.text}")
```

Server Side

Use the full SDK on your backend to manage sessions, run AI pipelines, and handle webhooks. Your API key should never be exposed to the browser.

```
# Create a capture session and generate a client token
cap = conn.create_capture_session(end_user_id="user_123")
token = conn.generate_client_token(expires_in=600)
```

Client Side

For real-time desktop capture, install the Capture SDK on your client application. It uses short-lived tokens instead of your API key.

Desktop capture currently supports **macOS** and  **Windows** .

```
pip install "videodb[capture]"
```

[Capture SDK OverviewLearn how to integrate real-time screen, audio, and camera capture into your application](https://docs.videodb.io/pages/ingest/capture-sdks/overview)

Next Steps

[QuickstartBuild your first perception-enabled agent](https://docs.videodb.io/pages/getting-started/quickstart)

[API ReferenceComplete REST API documentation](https://docs.videodb.io/api-reference/introduction)

[Quickstart](https://docs.videodb.io/pages/getting-started/quickstart)[Node.js SDK](https://docs.videodb.io/pages/getting-started/node)

[x](https://x.com/videodb_io)[github](https://github.com/video-db)[linkedin](https://www.linkedin.com/company/videodb)[discord](https://discord.com/invite/py9P639jGz)
