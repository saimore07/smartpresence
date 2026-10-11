from typing import List, Optional
from pydantic import BaseModel, Field

class EnrolledStudentCandidate(BaseModel):
    student_id: str = Field(..., description="Stable system student identifier")
    name: str = Field(..., description="Student full name")
    roll_number: str = Field(..., description="Roll number")
    embedding: List[float] = Field(..., description="128-dimensional L2-normalized face embedding")

class RecognizeGroupMeta(BaseModel):
    class_name: Optional[str] = None
    subject: Optional[str] = None
    session_date: Optional[str] = None
