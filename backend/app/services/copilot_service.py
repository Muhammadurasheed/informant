"""
Informant Co-Pilot Service — Memory-Aware Chat Engine

This service powers the chat interface in the Informant side panel.
It combines three knowledge sources:
1. VideoDB Visual Memory — What the user saw on screen (indexed scenes)
2. Uploaded Documents — PDFs, resumes, etc. parsed into text
3. User Profile — Basic identity information

When the user asks a question, we:
1. Search VideoDB memory for relevant visual evidence
2. Combine with any document context
3. Send to Gemini to synthesize a human-friendly answer
4. Return the answer with playable evidence links
"""

import structlog
from typing import Dict, Any, List, Optional
import json

from app.services.ai_service import ai_service
from app.services.videodb_service import videodb_service

logger = structlog.get_logger()


class CopilotService:
    """Memory-aware chat engine for Informant"""

    async def chat(
        self,
        query: str,
        page_context: Dict[str, Any],
        user_id: str,
        project_context: Optional[str] = None,
        user_profile: Optional[Dict[str, Any]] = None,
        mentioned_docs: Optional[List[str]] = None,
        include_profile: bool = True
    ) -> Dict[str, Any]:
        """
        Main chat handler — combines VideoDB memory search with AI synthesis.

        This is Scene 5 of Rasheed's journey: the mind-blown moment.
        """

        page_url = page_context.get('url', '')
        page_title = page_context.get('title', '')

        # Step 1: Search VideoDB visual memory for relevant evidence
        memory_results = await videodb_service.search_memory(
            user_id=user_id,
            query=query
        )

        evidence = memory_results.get("results", [])
        has_memory = len(evidence) > 0

        # Step 2: Build the knowledge base
        # Document context (uploaded PDFs, resumes, etc.)
        doc_section = ""
        if project_context and len(project_context.strip()) > 50:
            if mentioned_docs and len(mentioned_docs) > 0:
                doc_section = f"""📎 REFERENCED DOCUMENTS ({len(mentioned_docs)} docs): {', '.join(mentioned_docs)}

=== DOCUMENT CONTENT ===
{project_context}
=== END DOCUMENT CONTENT ===

Use the document content above to answer the user's question. Extract specific details."""
            else:
                doc_section = f"""📎 UPLOADED DOCUMENTS AVAILABLE:

=== DOCUMENT CONTENT ===
{project_context}
=== END DOCUMENT CONTENT ==="""

        # Profile context
        profile_section = ""
        if include_profile and user_profile:
            profile_section = f"""👤 USER PROFILE:
{json.dumps(user_profile, indent=2)}"""

        # Visual memory context (from VideoDB)
        memory_section = ""
        if has_memory:
            memory_entries = []
            for i, item in enumerate(evidence[:10]):  # Top 10 results
                entry = f"[{i+1}] (confidence: {item.get('confidence', 'N/A')}) {item.get('text', '')}"
                if item.get('playback_url'):
                    entry += f"\n    🎬 Evidence: {item['playback_url']}"
                memory_entries.append(entry)

            memory_section = f"""🧠 VISUAL MEMORY (from your browsing sessions — indexed by VideoDB):
{chr(10).join(memory_entries)}

IMPORTANT: These are real memories from pages the user browsed. Cite them with confidence."""

        # Step 3: Build the prompt
        prompt = f"""You are **Informant**, an AI browser co-pilot that sees everything the user browses and remembers it all.

=== KNOWLEDGE BASE ===

{memory_section if memory_section else "🧠 No browsing memories found for this query. The user may not have started a capture session yet."}

{doc_section if doc_section else "📎 No documents uploaded."}

{profile_section if profile_section else "👤 No user profile available."}

CURRENT PAGE:
- Title: {page_title}
- URL: {page_url}

=== USER QUESTION ===
{query}

=== INSTRUCTIONS ===
1. **Answer using the knowledge base above.** Prioritize visual memory evidence.
2. If you found relevant memories, present the information clearly with specific details (dates, amounts, requirements, etc.).
3. If there's a playable evidence link, mention it: "🎬 [View the moment you saw this →](link)"
4. **Be concise.** The user is in a small side panel. Keep answers focused.
5. If no relevant memory exists, say so honestly and suggest the user start a capture session.
6. If documents are available, use them to supplement your answer.
7. Format with markdown for readability (bold key facts, use bullet lists).

Respond directly — no JSON wrapping, no preamble. Just the answer."""

        try:
            result = await ai_service.generate_content_async(prompt)

            if not result:
                raise ValueError("Empty response from AI")

            response_text = result.strip()

            return {
                "message": response_text,
                "has_memory_evidence": has_memory,
                "evidence_count": len(evidence),
                "evidence": evidence[:5] if has_memory else [],  # Top 5 evidence items
                "source": "videodb_memory" if has_memory else "general"
            }

        except Exception as e:
            error_msg = str(e)
            logger.error("Informant chat failed", error=error_msg)

            hint = "I'm having trouble processing your request."
            if "429" in error_msg or "quota" in error_msg.lower():
                hint = "I'm a bit overwhelmed right now (rate limit). Please try again in a few seconds."
            elif "403" in error_msg:
                hint = "I'm having trouble accessing my AI core (auth issue)."

            return {
                "message": f"{hint}",
                "has_memory_evidence": False,
                "evidence_count": 0,
                "evidence": [],
                "source": "error"
            }

    async def generate_field_content(
        self,
        target_field: Dict[str, Any],
        user_profile: Dict[str, Any],
        user_id: str,
        instruction: Optional[str] = None,
        page_url: Optional[str] = None,
        project_context: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Sparkle — Generate content for a form field.
        Uses VideoDB memory + documents + profile to fill fields.
        """

        # Search memory for relevant context about this field
        field_label = target_field.get('label', target_field.get('name', 'field'))
        memory_results = await videodb_service.search_memory(
            user_id=user_id,
            query=f"{field_label} requirements application"
        )

        memory_context = ""
        evidence = memory_results.get("results", [])
        if evidence:
            memory_entries = [f"- {item.get('text', '')}" for item in evidence[:5]]
            memory_context = f"\nRELEVANT BROWSING MEMORY:\n" + "\n".join(memory_entries)

        prompt = f"""You are Informant, an expert application writer. Write content for the field below.

FIELD: {target_field.get('label', 'Unknown')}
TYPE: {target_field.get('type', 'text')}
CONTEXT: {target_field.get('surroundingContext', 'N/A')}

USER PROFILE:
{json.dumps(user_profile, indent=2) if user_profile else 'Not provided.'}

DOCUMENT CONTEXT:
{project_context[:40000] if project_context else 'No documents uploaded.'}
{memory_context}

When multiple documents or sources are provided above, intelligently cross-reference and synthesize the most relevant details across all active knowledge sources to perfectly fill the form field.

SPECIAL INSTRUCTIONS: {instruction or 'Write authentic, detailed content.'}

RULES:
1. Use SPECIFIC details from the active knowledge base — names, skills, dates, metrics.
2. Never invent facts not present in the knowledge base.
3. Write in first person, as the applicant.
4. Make it sound human and authentic, not AI-generated.
5. Plain text only — no markdown symbols.

Write ONLY the field content. No preamble, no explanations:
"""

        try:
            result = await ai_service.generate_content_async(prompt)

            if not result or not result.strip():
                raise ValueError("Empty response from AI")

            content = result.strip()

            # Clean any AI preamble
            preamble_patterns = [
                'here is', "here's", 'sure,', 'certainly', 'of course',
                'below is', 'the content:', 'here is the content'
            ]
            first_line = content.split('\n')[0].lower()
            if any(first_line.startswith(p) for p in preamble_patterns):
                content = '\n'.join(content.split('\n')[1:]).strip()

            # Strip wrapping quotes
            if content.startswith('"') and content.endswith('"'):
                content = content[1:-1].strip()

            # Enforce character limit
            char_limit = target_field.get('characterLimit')
            if char_limit and len(content) > char_limit:
                content = content[:char_limit - 3].rsplit(' ', 1)[0] + '...'

            return {
                "content": content,
                "reasoning": f"Based on {'memory + ' if evidence else ''}{'documents + ' if project_context else ''}profile"
            }

        except Exception as e:
            logger.error("Sparkle generation failed", error=str(e))
            return {
                "content": "",
                "reasoning": f"Generation failed: {str(e)[:100]}"
            }


copilot_service = CopilotService()
