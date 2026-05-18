"""
Configuration management for Informant Backend
Handles environment variables and application settings
"""
import os
from typing import List, Optional
from pydantic_settings import BaseSettings
from pydantic import Field, field_validator


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""
    
    # Server Configuration
    host: str = Field(default="0.0.0.0", env="HOST")
    port: int = Field(default=8000, env="PORT")
    debug: bool = Field(default=True, env="DEBUG")
    environment: str = Field(default="development", env="ENVIRONMENT")
    
    # Hackathon Demo Mode
    enable_guest_mode: bool = Field(default=True, env="ENABLE_GUEST_MODE")
    guest_uid: str = Field(default="demo_guest_user", env="GUEST_UID")
    
    # Firebase Configuration
    firebase_project_id: Optional[str] = Field(default=None, env="FIREBASE_PROJECT_ID")
    firebase_private_key_id: Optional[str] = Field(default=None, env="FIREBASE_PRIVATE_KEY_ID")
    firebase_private_key: Optional[str] = Field(default=None, env="FIREBASE_PRIVATE_KEY")
    firebase_client_email: Optional[str] = Field(default=None, env="FIREBASE_CLIENT_EMAIL")
    firebase_client_id: Optional[str] = Field(default=None, env="FIREBASE_CLIENT_ID")
    firebase_auth_uri: Optional[str] = Field(default="https://accounts.google.com/o/oauth2/auth", env="FIREBASE_AUTH_URI")
    firebase_token_uri: Optional[str] = Field(default="https://oauth2.googleapis.com/token", env="FIREBASE_TOKEN_URI")
    firebase_auth_provider_x509_cert_url: Optional[str] = Field(default="https://www.googleapis.com/oauth2/v1/certs", env="FIREBASE_AUTH_PROVIDER_X509_CERT_URL")
    firebase_client_x509_cert_url: Optional[str] = Field(default=None, env="FIREBASE_CLIENT_X509_CERT_URL")
    
    # Google Gemini AI
    gemini_api_key: Optional[str] = Field(default=None, env="GEMINI_API_KEY")
    gemini_model: str = Field(default="gemini-1.5-flash", env="GEMINI_MODEL")
    
    # VideoDB Configuration
    videodb_api_key: Optional[str] = Field(default=None, env="VIDEODB_API_KEY")
    videodb_collection_id: str = Field(default="default", env="VIDEODB_COLLECTION_ID")
    
    # CORS Settings (stored as comma-separated string)
    cors_origins: str = Field(
        default="http://localhost:5173,http://localhost:3000",
        env="CORS_ORIGINS"
    )
    
    # Rate Limiting
    rate_limit_per_minute: int = Field(default=60, env="RATE_LIMIT_PER_MINUTE")
    gemini_rate_limit_per_hour: int = Field(default=1000, env="GEMINI_RATE_LIMIT_PER_HOUR")
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False
        extra = "ignore"
        
    @property
    def cors_origins_list(self) -> List[str]:
        """Parse comma-separated CORS origins into a list"""
        return [origin.strip() for origin in self.cors_origins.split(',') if origin.strip()]
    
    @property
    def firebase_credentials(self) -> dict:
        """Format Firebase credentials for admin SDK initialization"""
        private_key = self.firebase_private_key
        if private_key:
            # Handle both literal \n, escaped \\n, and actual newlines
            private_key = private_key.replace('\\n', '\n').replace('\\\\n', '\n')
            
            # Remove quotes if they were accidentally included in the string
            if private_key.startswith('"') and private_key.endswith('"'):
                private_key = private_key[1:-1]
            if private_key.startswith("'") and private_key.endswith("'"):
                private_key = private_key[1:-1]
                
        return {
            "type": "service_account",
            "project_id": self.firebase_project_id,
            "private_key_id": self.firebase_private_key_id,
            "private_key": private_key,
            "client_email": self.firebase_client_email,
            "client_id": self.firebase_client_id,
            "auth_uri": self.firebase_auth_uri,
            "token_uri": self.firebase_token_uri,
            "auth_provider_x509_cert_url": self.firebase_auth_provider_x509_cert_url,
            "client_x509_cert_url": self.firebase_client_x509_cert_url,
        }


# Global settings instance
settings = Settings()
