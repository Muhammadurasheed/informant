"""
Pydantic models for Informant API
Data validation and serialization schemas
"""
from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field


# ========== Session Models ==========

class StartSessionRequest(BaseModel):
    """Request to start a new capture session"""
    metadata: Optional[Dict[str, Any]] = None


class StopSessionRequest(BaseModel):
    """Request to stop a capture session"""
    session_id: str


class SessionStatus(BaseModel):
    """Current session status"""
    active: bool
    session_id: Optional[str] = None
    chunk_count: int = 0
    duration_seconds: float = 0
    videos_indexed: int = 0
    status: str = "idle"


# ========== Memory Models ==========

class MemorySearchRequest(BaseModel):
    """Request to search visual memory"""
    query: str
    session_id: Optional[str] = None


class MemoryEvidence(BaseModel):
    """A single piece of evidence from memory search"""
    text: str
    start: float = 0
    end: float = 0
    confidence: Optional[float] = None
    playback_url: Optional[str] = None


class MemorySearchResponse(BaseModel):
    """Response from memory search"""
    results: List[MemoryEvidence] = Field(default_factory=list)
    query: str
    total_results: int = 0
    error: Optional[str] = None


# ========== Chat Models ==========

class ChatRequest(BaseModel):
    """Chat request from the side panel"""
    query: str
    page_context: Dict[str, Any]
    project_context: Optional[str] = None
    mentioned_docs: Optional[List[str]] = None
    include_profile: bool = True


class ChatResponse(BaseModel):
    """Chat response with memory evidence"""
    message: str
    has_memory_evidence: bool = False
    evidence_count: int = 0
    evidence: List[Dict[str, Any]] = Field(default_factory=list)
    source: str = "general"


# ========== Field Generation Models ==========

class FieldMappingRequest(BaseModel):
    """Request body for form field mapping / sparkle generation"""
    form_fields: List[Dict[str, Any]] = Field(default_factory=list)
    user_profile: Dict[str, Any] = Field(default_factory=dict)
    project_context: Optional[str] = None
    target_field: Optional[Dict[str, Any]] = None
    instruction: Optional[str] = None


class SparkleResult(BaseModel):
    """Result from sparkle field generation"""
    content: str
    reasoning: str


# ========== User Profile (Simplified for Informant) ==========

class UserProfile(BaseModel):
    """User profile data"""
    name: str = "User"
    email: Optional[str] = None
    bio: Optional[str] = None
    skills: List[str] = Field(default_factory=list)
    interests: List[str] = Field(default_factory=list)
    country: Optional[str] = None


# ========== Error Models ==========

class ErrorResponse(BaseModel):
    """Standard error response format"""
    error: str
    detail: Optional[str] = None
    status_code: int
