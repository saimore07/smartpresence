from fastapi import Header, HTTPException, status
from app.config import settings

async def verify_internal_auth(x_internal_secret: str = Header(None, alias="X-Internal-Secret")):
    """
    Verify that incoming requests originate from the trusted Node.js backend
    using the shared service secret.
    """
    if not x_internal_secret or x_internal_secret != settings.INTERNAL_API_SECRET:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Invalid or missing internal service authorization secret."
        )
    return True
