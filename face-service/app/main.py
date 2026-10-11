import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.api.health import router as health_router
from app.api.detection import router as detection_router
from app.api.recognition import router as recognition_router
from app.services.face_detector import FaceDetectorService
from app.services.embedding_service import EmbeddingService

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("smartpresence.face_service")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Pre-warm models once
    logger.info("Starting %s in %s mode...", settings.SERVICE_NAME, settings.ENVIRONMENT)
    try:
        FaceDetectorService.get_instance()
        logger.info("YuNet Face Detector initialized.")
        EmbeddingService.get_instance()
        logger.info("SFace Face Recognizer initialized.")
        logger.info("Models loaded and ready for inference.")
    except Exception as e:
        logger.error("Failed to pre-warm models: %s", str(e))
    yield
    logger.info("Shutting down %s...", settings.SERVICE_NAME)

app = FastAPI(
    title=settings.SERVICE_NAME,
    version="1.0.0",
    description="High-performance, legally compliant AI face recognition microservice for SmartPresence attendance system.",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Exception handler to prevent internal trace leaks
@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled error processing %s: %s", request.url.path, str(exc))
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "message": "An internal error occurred during facial processing.",
            "error_type": type(exc).__name__
        }
    )

# Include API routers
app.include_router(health_router)
app.include_router(detection_router)
app.include_router(recognition_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=True)
