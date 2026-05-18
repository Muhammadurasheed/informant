"""
Informant VideoDB Service — Perception, Memory & Action Engine

Fixes applied:
  - BUG #2: index_scenes() → index_visuals() (correct SDK v0.4.0 method)
  - BUG #3: shot.search_score → shot.score (correct SDK attribute)
  - BUG #4: All blocking SDK calls wrapped in asyncio.run_in_executor
  - NEW: upload_and_index_session() triggered on stop for reliable single-upload
  - NEW: indexing status tracking so UI can show "indexing..." → "ready"
"""

import videodb
import structlog
import os
import asyncio
import aiofiles
import time
import json
from typing import Optional, Dict, Any, List
from app.config import settings
from app.services.ai_service import ai_service

logger = structlog.get_logger()


class VideoDBService:
    """VideoDB-powered perception and memory engine for Informant"""

    def __init__(self):
        self.conn = None
        self.collection = None
        # Track active sessions: user_id -> session metadata
        self.active_sessions: Dict[str, Dict[str, Any]] = {}

        if settings.videodb_api_key:
            try:
                self.conn = videodb.connect(api_key=settings.videodb_api_key)
                self.collection = self.conn.get_collection()
                logger.info(
                    "VideoDB: Connected successfully",
                    collection_id=self.collection.id if self.collection else "default"
                )
            except Exception as e:
                logger.error("VideoDB: Connection failed", error=str(e))
        else:
            logger.warning("VideoDB: API key missing, service disabled")

    # ========== SEE: Session & Capture Management ==========

    def start_session(self, user_id: str) -> Optional[Dict[str, Any]]:
        """
        Start a new capture session for a user.
        Creates a local directory for chunks and registers the session.
        """
        session_id = f"session_{user_id}_{int(time.time())}"
        session_dir = os.path.join("capture_sessions", user_id, session_id)
        os.makedirs(session_dir, exist_ok=True)

        session_meta = {
            "session_id": session_id,
            "user_id": user_id,
            "session_dir": session_dir,
            "started_at": time.time(),
            "chunk_count": 0,
            "status": "recording",
            "videodb_video_ids": [],
            # New: track indexing state
            "indexing_status": "idle",  # idle | uploading | indexing | ready | failed
            "indexed_video_id": None,
        }

        self.active_sessions[user_id] = session_meta

        logger.info("Informant: Session started", session_id=session_id, user_id=user_id)

        return {
            "session_id": session_id,
            "status": "recording",
            "message": "Session started. I'm now watching and remembering everything."
        }

    async def save_chunk(self, user_id: str, session_id: str, file: Any) -> Dict[str, Any]:
        """
        Save a screen capture chunk from the extension.
        Chunks are saved locally and uploaded as one batch when the session stops.
        """
        session = self.active_sessions.get(user_id)
        if not session or session["session_id"] != session_id:
            return {"success": False, "error": "No active session found"}

        try:
            chunk_index = session["chunk_count"]
            chunk_filename = f"chunk_{chunk_index:04d}_{int(time.time())}.webm"
            chunk_path = os.path.join(session["session_dir"], chunk_filename)

            async with aiofiles.open(chunk_path, 'wb') as out_file:
                content = await file.read()
                await out_file.write(content)

            session["chunk_count"] += 1
            chunk_size = len(content)

            logger.info(
                "Informant: Chunk saved",
                session_id=session_id,
                chunk_index=chunk_index,
                size_bytes=chunk_size
            )

            return {
                "success": True,
                "chunk_index": chunk_index,
                "size": chunk_size,
                "indexed": False  # Indexing happens on stop, not per-chunk
            }

        except Exception as e:
            logger.error("Informant: Chunk save failed", error=str(e))
            return {"success": False, "error": str(e)}

    def stop_session(self, user_id: str, visited_pages: Optional[List[str]] = None) -> Dict[str, Any]:
        """Stop an active capture session."""
        session = self.active_sessions.get(user_id)
        if not session:
            return {"success": False, "error": "No active session found"}

        session["status"] = "stopped"
        session["stopped_at"] = time.time()
        session["visited_pages"] = visited_pages or []
        duration = session["stopped_at"] - session["started_at"]

        logger.info(
            "Informant: Session stopped",
            session_id=session["session_id"],
            chunks=session["chunk_count"],
            visited_count=len(session["visited_pages"]),
            duration_secs=round(duration, 1)
        )

        return {
            "success": True,
            "session_id": session["session_id"],
            "chunks_captured": session["chunk_count"],
            "duration_seconds": round(duration, 1),
            "message": f"Session stopped. {session['chunk_count']} chunk(s) captured. Uploading to memory..."
        }

    async def upload_and_index_session(self, user_id: str) -> Dict[str, Any]:
        """
        Upload all session chunks to VideoDB and index for memory search.

        This is called as a background task after stop_session().
        Strategy: upload each chunk individually and index it — this way even
        short sessions get indexed fast and search works immediately.
        """
        session = self.active_sessions.get(user_id)
        if not session:
            return {"success": False, "error": "No session found"}

        if not self.conn or not self.collection:
            logger.warning("VideoDB: Not connected, skipping upload")
            session["indexing_status"] = "failed"
            return {"success": False, "error": "VideoDB not connected"}

        session_dir = session["session_dir"]
        session["indexing_status"] = "uploading"

        # Collect all .webm chunk files
        try:
            chunk_files = sorted([
                os.path.join(session_dir, f)
                for f in os.listdir(session_dir)
                if f.endswith(".webm")
            ])
        except Exception as e:
            logger.error("Informant: Failed to list chunk files", error=str(e))
            session["indexing_status"] = "failed"
            return {"success": False, "error": str(e)}

        if not chunk_files:
            logger.warning("Informant: No chunks to upload", session_id=session["session_id"])
            session["indexing_status"] = "failed"
            return {"success": False, "error": "No captured video chunks found"}

        logger.info(
            "Informant: Starting upload to VideoDB",
            session_id=session["session_id"],
            chunk_count=len(chunk_files)
        )

        loop = asyncio.get_event_loop()
        uploaded_ids = []

        for i, chunk_path in enumerate(chunk_files):
            video_id = await self._upload_and_index_chunk(chunk_path, session["session_id"], i, loop)
            if video_id:
                uploaded_ids.append(video_id)
                session["videodb_video_ids"].append(video_id)

        if uploaded_ids:
            session["indexing_status"] = "ready"
            session["indexed_video_id"] = uploaded_ids[0]

            # Generate dynamic AI summary from visited pages
            summary = "AI-captured browsing session recording. Fully indexed across visual scenes and audio for instant natural-language recall."
            visited = session.get("visited_pages", [])
            if visited:
                try:
                    prompt = f"Generate a concise, professional 2-sentence summary of what the user browsed based on these visited webpage titles:\n{json.dumps(visited[:15])}\nReturn ONLY the summary text without quotes or preamble."
                    ai_res = await ai_service.generate_content_async(prompt)
                    if ai_res and ai_res.strip():
                        summary = ai_res.strip()
                except Exception as e:
                    logger.error("Failed to generate dynamic AI summary", error=str(e))

            session["summary"] = summary
            try:
                meta_path = os.path.join(session_dir, "metadata.json")
                with open(meta_path, "w") as f:
                    json.dump({
                        "session_id": session["session_id"],
                        "visited_pages": visited,
                        "summary": summary,
                        "started_at": session["started_at"],
                        "stopped_at": session.get("stopped_at", time.time())
                    }, f, indent=2)
            except Exception as e:
                logger.error("Failed to write metadata.json", error=str(e))

            logger.info(
                "Informant: Session fully indexed",
                session_id=session["session_id"],
                videos_indexed=len(uploaded_ids),
                summary=summary
            )
            return {
                "success": True,
                "videos_indexed": len(uploaded_ids),
                "video_ids": uploaded_ids
            }
        else:
            session["indexing_status"] = "failed"
            return {"success": False, "error": "All uploads failed — check VideoDB API key and credits"}

    async def _upload_and_index_chunk(
        self, file_path: str, session_id: str, chunk_index: int, loop=None
    ) -> Optional[str]:
        """
        Upload a single video chunk to VideoDB and index visuals + audio.
        All SDK calls run in executor to avoid blocking the event loop.
        """
        if not self.conn or not self.collection:
            return None

        from pathlib import Path
        abs_path = str(Path(file_path).resolve())

        if not os.path.exists(abs_path):
            logger.error("VideoDB: Chunk file not found", path=abs_path)
            return None

        file_size = os.path.getsize(abs_path)
        if file_size < 1024:  # Skip tiny/empty chunks
            logger.warning("VideoDB: Skipping tiny chunk", path=abs_path, size=file_size)
            return None

        if loop is None:
            loop = asyncio.get_event_loop()

        try:
            # ── CONVERT WEBM TO PROPERLY INDEXED MP4 VIA OPENCV ─────────
            mp4_path = abs_path.replace(".webm", ".mp4")

            def do_convert():
                try:
                    import cv2
                    logger.info("VideoDB: Converting unindexed WebM to seekable MP4", source=abs_path)
                    cap = cv2.VideoCapture(abs_path)
                    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
                    if fps <= 0 or fps > 120:
                        fps = 30.0
                    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                    if w <= 0 or h <= 0:
                        w, h = 1280, 720
                    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
                    out = cv2.VideoWriter(mp4_path, fourcc, fps, (w, h))
                    count = 0
                    while True:
                        ret, frame = cap.read()
                        if not ret:
                            break
                        out.write(frame)
                        count += 1
                    cap.release()
                    out.release()
                    logger.info("VideoDB: Converted WebM successfully", mp4_path=mp4_path, frames=count)
                    if os.path.exists(mp4_path) and os.path.getsize(mp4_path) > 1024:
                        return mp4_path
                except Exception as cv_err:
                    logger.error("VideoDB: OpenCV conversion failed", error=str(cv_err))
                return abs_path

            upload_file_path = await loop.run_in_executor(None, do_convert)

            # ── UPLOAD (blocking call → run in thread) ──────────────────────
            logger.info(
                "VideoDB: Uploading chunk",
                session_id=session_id,
                chunk_index=chunk_index,
                path=upload_file_path,
                size_bytes=os.path.getsize(upload_file_path)
            )

            chunk_name = f"informant_{session_id}_chunk{chunk_index:04d}"

            def do_upload():
                return self.collection.upload(
                    file_path=upload_file_path,
                    media_type="video",
                    name=chunk_name
                )

            video = await loop.run_in_executor(None, do_upload)

            if not video:
                logger.error("VideoDB: Upload returned None", chunk=chunk_index)
                return None

            logger.info(
                "VideoDB: Chunk uploaded ✓",
                video_id=video.id,
                session_id=session_id,
                chunk_index=chunk_index
            )

            # ── INDEX VISUALS — THE PERCEPTION LAYER ───────────────────────
            # FIX: use index_visuals() not index_scenes() (Bug #2)
            visual_prompt = (
                "Describe the webpage content visible on screen in detail: "
                "page title, headings, key text content, deadlines, requirements, "
                "eligibility criteria, funding amounts, form fields, links, dates, "
                "and any important information. Note the website URL if visible in "
                "the browser address bar. Extract ALL readable text from the page."
            )

            def do_index_visuals():
                video.index_visuals(prompt=visual_prompt)

            await loop.run_in_executor(None, do_index_visuals)
            logger.info("VideoDB: Visual indexing completed ✓", video_id=video.id)

            # ── INDEX AUDIO (spoken words on page) ─────────────────────────
            try:
                def do_index_audio():
                    video.index_spoken_words()

                await loop.run_in_executor(None, do_index_audio)
                logger.info("VideoDB: Audio indexing completed ✓", video_id=video.id)
            except Exception as audio_err:
                logger.debug(
                    "VideoDB: No audio track (expected for silent captures)",
                    error=str(audio_err)
                )

            return video.id

        except Exception as e:
            logger.error(
                "VideoDB: Upload/index failed",
                error=str(e),
                error_type=type(e).__name__,
                file_path=abs_path,
                session_id=session_id
            )
            return None

    # ========== REMEMBER & RECALL: Search Memory ==========

    async def search_memory(
        self, user_id: str, query: str, session_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Search through VideoDB indexed memory using natural language.
        Returns timestamped results with playable evidence links.
        """
        if not self.conn or not self.collection:
            return {
                "results": [],
                "error": "VideoDB not connected",
                "query": query
            }

        loop = asyncio.get_event_loop()

        try:
            # Check if we have any indexed videos first
            def do_get_videos():
                return self.collection.get_videos()

            videos = await loop.run_in_executor(None, do_get_videos)

            if not videos:
                logger.info("Informant: No videos indexed yet", user_id=user_id)
                return {
                    "results": [],
                    "error": "no_videos_indexed",
                    "query": query,
                    "total_results": 0
                }

            logger.info(
                "Informant: Searching memory",
                query=query,
                user_id=user_id,
                indexed_videos=len(videos)
            )

            def do_search():
                # Search both visual scenes and spoken words, then combine
                scene_shots = []
                audio_shots = []
                
                try:
                    scene_res = self.collection.search(query=query, index_type="scene")
                    scene_shots = scene_res.shots if scene_res else []
                except Exception as e:
                    logger.warning("Scene search failed", error=str(e))
                    
                try:
                    audio_res = self.collection.search(query=query)
                    audio_shots = audio_res.shots if audio_res else []
                except Exception as e:
                    logger.warning("Audio search failed", error=str(e))
                    
                all_shots = scene_shots + audio_shots
                # Sort by score descending
                all_shots.sort(
                    key=lambda s: getattr(s, 'score', getattr(s, 'search_score', 0) or 0), 
                    reverse=True
                )
                
                class CombinedResults:
                    def __init__(self, shots):
                        self.shots = shots
                
                return CombinedResults(all_shots)

            results = await loop.run_in_executor(None, do_search)

            evidence = []
            for shot in results.shots:
                shot_data = {
                    "text": shot.text,
                    "start": shot.start,
                    "end": shot.end,
                    # FIX: use shot.score not shot.search_score (Bug #3)
                    "confidence": getattr(shot, 'score', getattr(shot, 'search_score', None)),
                }

                # Generate a playable stream URL for this evidence
                try:
                    def make_stream(s=shot):
                        return s.generate_stream()
                    stream_url = await loop.run_in_executor(None, make_stream)
                    shot_data["playback_url"] = stream_url
                except Exception:
                    shot_data["playback_url"] = None

                evidence.append(shot_data)

            logger.info(
                "Informant: Memory search completed",
                query=query,
                results_count=len(evidence),
                user_id=user_id
            )

            return {
                "results": evidence,
                "query": query,
                "total_results": len(evidence)
            }

        except Exception as e:
            error_str = str(e)
            logger.error(
                "Informant: Memory search failed",
                error=error_str,
                error_type=type(e).__name__,
                query=query,
                user_id=user_id
            )
            return {
                "results": [],
                "error": error_str,
                "query": query
            }

    def get_session_status(self, user_id: str) -> Dict[str, Any]:
        """Get the current session status for a user"""
        session = self.active_sessions.get(user_id)
        if not session:
            return {
                "active": False,
                "session_id": None,
                "indexing_status": "idle"
            }

        return {
            "active": session["status"] == "recording",
            "session_id": session["session_id"],
            "chunk_count": session["chunk_count"],
            "duration_seconds": round(time.time() - session["started_at"], 1),
            "videos_indexed": len(session["videodb_video_ids"]),
            "status": session["status"],
            "indexing_status": session.get("indexing_status", "idle"),
            "memory_ready": session.get("indexing_status") == "ready",
        }


# Singleton instance
videodb_service = VideoDBService()
