"""
Firebase Firestore database layer for Informant
Handles all database operations for user profiles and chat history
"""
import firebase_admin
from firebase_admin import credentials, firestore
from typing import Optional, List, Dict, Any
import structlog
import os

from app.config import settings
from app.models import UserProfile

logger = structlog.get_logger()

class FirebaseDB:
    """Firebase Firestore database manager"""
    
    def __init__(self):
        """Initialize Firebase Admin SDK"""
        try:
            firebase_admin.get_app()
            logger.info("Firebase already initialized")
        except ValueError:
            # Prioritize the specific JSON file provided by the user
            json_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "informant-i4i-firebase-adminsdk-fbsvc-0c4b0be226.json")
            
            if os.path.exists(json_path):
                logger.info("Found service account JSON file, using it for initialization", path=json_path)
                cred = credentials.Certificate(json_path)
            else:
                logger.info("Service account JSON not found at root, falling back to environment variables")
                cred = credentials.Certificate(settings.firebase_credentials)
                
            firebase_admin.initialize_app(cred)
            logger.info("Firebase initialized successfully")
        
        self.db = firestore.client()
    
    # User Profile Operations
    async def get_user_profile(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Fetch user profile from Firestore"""
        try:
            doc_ref = self.db.collection('users').document(user_id)
            doc = doc_ref.get()
            
            if doc.exists:
                return doc.to_dict()
            return None
        except Exception as e:
            error_str = str(e)
            if "The database (default) does not exist" in error_str or "Database not found" in error_str:
                logger.warning("Firestore database not configured, proceeding with in-memory profile", error=error_str)
                return None
            logger.error("Failed to fetch user profile", user_id=user_id, error=error_str)
            return None
    
    async def update_user_profile(self, user_id: str, profile: UserProfile) -> bool:
        """Update user profile in Firestore"""
        try:
            doc_ref = self.db.collection('users').document(user_id)
            doc_ref.set({
                'profile': profile.model_dump(),
                'updated_at': firestore.SERVER_TIMESTAMP
            }, merge=True)
            logger.info("User profile updated", user_id=user_id)
            return True
        except Exception as e:
            logger.error("Failed to update user profile", user_id=user_id, error=str(e))
            raise

    # Chat History Operations
    async def save_chat_message(self, user_id: str, role: str, content: str) -> bool:
        """Save a chat message to conversation history"""
        try:
            doc_ref = self.db.collection('chat_history').document(user_id).collection('messages').document()
            doc_ref.set({
                'role': role,
                'content': content,
                'timestamp': firestore.SERVER_TIMESTAMP
            })
            return True
        except Exception as e:
            logger.error("Failed to save chat message", user_id=user_id, error=str(e))
            return False
    
    async def get_chat_history(self, user_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        """Get conversation history for a user"""
        try:
            messages = self.db.collection('chat_history').document(user_id).collection('messages')\
                .order_by('timestamp', direction=firestore.Query.DESCENDING)\
                .limit(limit)\
                .stream()
            
            history = []
            for msg in messages:
                history.append(msg.to_dict())
            
            history.reverse()
            return history
        except Exception as e:
            logger.error("Failed to fetch chat history", user_id=user_id, error=str(e))
            return []
    
    async def clear_chat_history(self, user_id: str) -> bool:
        """Clear conversation history for a user"""
        try:
            messages = self.db.collection('chat_history').document(user_id).collection('messages').stream()
            batch = self.db.batch()
            count = 0
            for msg in messages:
                batch.delete(msg.reference)
                count += 1
                if count >= 500:
                    batch.commit()
                    batch = self.db.batch()
                    count = 0
            if count > 0:
                batch.commit()
            return True
        except Exception as e:
            logger.error("Failed to clear chat history", user_id=user_id, error=str(e))
            raise

# Global database instance
db = FirebaseDB()

# Helper functions for easy imports
async def get_user_profile(user_id: str) -> Optional[Dict[str, Any]]:
    """Helper function to get user profile"""
    return await db.get_user_profile(user_id)
