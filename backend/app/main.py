"""
Informant FastAPI Backend
Main application entry point
"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import structlog
import logging

import sys

from app.config import settings
from app.routes import extension

# Ensure standard logging is configured so structlog records print to console
logging.basicConfig(level=logging.INFO, stream=sys.stdout)

# Configure structured logging
log_renderer = (
    structlog.processors.JSONRenderer()
    if settings.environment == "production"
    else structlog.dev.ConsoleRenderer(colors=True)
)

structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="%Y-%m-%d %H:%M:%S" if settings.environment != "production" else "iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        log_renderer
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()

# Initialize FastAPI app
app = FastAPI(
    title="Informant API",
    description="AI browser co-pilot with eyes and ears — powered by VideoDB",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8000",
        "http://localhost:5173",
        "chrome-extension://*",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info("Request", method=request.method, path=request.url.path)
    response = await call_next(request)
    logger.info("Response", method=request.method, path=request.url.path, status=response.status_code)
    return response

# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled exception", error=str(exc), path=request.url.path, exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "detail": str(exc) if settings.debug else "An unexpected error occurred"
        }
    )

@app.get("/health")
async def health_check():
    return {"status": "healthy", "app": "Informant", "version": "2.0.0"}

@app.get("/")
async def root():
    return {"message": "Informant API — Your AI browser co-pilot with eyes and ears", "docs": "/docs"}

# Include routers
app.include_router(extension.router)
# Document parsing is now part of the extension router
app.include_router(extension.router, prefix="/api/documents", tags=["documents"], include_in_schema=False)

@app.on_event("startup")
async def startup_event():
    logger.info("Informant API starting", environment=settings.environment)

@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Informant API shutting down")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.host, port=settings.port, reload=settings.debug, log_level="info")
