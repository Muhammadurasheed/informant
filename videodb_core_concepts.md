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
