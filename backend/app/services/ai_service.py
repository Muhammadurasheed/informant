"""
Google Vertex AI Service
Handles AI-powered content generation for Informant using enterprise quotas
"""
import structlog
import asyncio
from typing import Dict
from google.oauth2 import service_account
import vertexai
from vertexai.generative_models import GenerativeModel, GenerationConfig

from app.config import settings

logger = structlog.get_logger()

class VertexAIService:
    """Google Vertex AI integration for Informant (enterprise rate limits)"""

    def __init__(self):
        """Initialize Vertex AI with Firebase Service Account"""
        try:
            import os
            # ai_service.py is in backend/app/services, so we need 4 dirnames to reach the root informant folder
            json_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "informant-i4i-firebase-adminsdk-fbsvc-0c4b0be226.json")
            
            if os.path.exists(json_path):
                credentials = service_account.Credentials.from_service_account_file(json_path)
                logger.info("Vertex AI: Using service account JSON file")
            else:
                creds_info = settings.firebase_credentials
                if not creds_info.get("private_key"):
                    logger.error("No Firebase Service Account credentials found for Vertex AI")
                    raise Exception("Missing Service Account credentials")
                credentials = service_account.Credentials.from_service_account_info(creds_info)
            
            # Initialize Vertex AI with the same project as Firebase
            vertexai.init(
                project=settings.firebase_project_id,
                location="us-central1",
                credentials=credentials
            )

            self.default_config = GenerationConfig(
                max_output_tokens=8192,
                temperature=0.7,
            )

            self.long_config = GenerationConfig(
                max_output_tokens=16384,
                temperature=0.7,
            )

            # Vertex AI models don't use the 'models/' prefix
            model_name = settings.gemini_model.replace("models/", "")
            
            # Fallback to standard names if needed
            if model_name == "gemini-1.5-flash":
                model_name = "gemini-1.5-flash-001"
            elif model_name == "gemini-1.5-pro":
                model_name = "gemini-1.5-pro-001"

            self.model = GenerativeModel(
                model_name=model_name,
                generation_config=self.default_config
            )

            self.long_model = GenerativeModel(
                model_name=model_name,
                generation_config=self.long_config
            )

            logger.info("Vertex AI initialized [OK]", model=model_name)
        except Exception as e:
            logger.error("Failed to initialize Vertex AI", error=str(e))
            raise

    async def generate_content_async(self, prompt: str) -> str:
        """Async Vertex AI call wrapped in thread pool executor to prevent blocking"""
        loop = asyncio.get_event_loop()
        try:
            # We wrap the synchronous Vertex AI call in executor to keep FastAPI event loop lightning fast
            def _call():
                response = self.model.generate_content(prompt)
                return response.text

            result = await loop.run_in_executor(None, _call)
            return result
        except Exception as e:
            error_str = str(e)
            logger.error("Vertex AI generation failed", error=error_str)
            raise e

    async def generate_long_content_async(self, prompt: str) -> str:
        """Async Vertex AI call for long-form content wrapped in executor"""
        loop = asyncio.get_event_loop()
        try:
            def _call():
                response = self.long_model.generate_content(prompt)
                return response.text

            result = await loop.run_in_executor(None, _call)
            return result
        except Exception as e:
            error_str = str(e)
            logger.error("Vertex AI long generation failed", error=error_str)
            raise e

    def _parse_json_safe(self, text: str) -> Dict:
        """Helper to clean and parse JSON from LLM"""
        import json
        text = text.strip()
        if text.startswith('```json'): text = text[7:]
        if text.startswith('```'): text = text[3:]
        if text.endswith('```'): text = text[:-3]
        return json.loads(text.strip())

# Global AI service instance
ai_service = VertexAIService()
