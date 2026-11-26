"""Request/response models for the Student Dashboard backend API."""

from __future__ import annotations

from pydantic import BaseModel, Field


class NoteIn(BaseModel):
    """One note sent in for searching, in the same shape as the frontend Note type."""

    id: str = ""
    title: str = ""
    content: str = ""
    folder: str | None = None
    tags: list[str] = Field(default_factory=list)


class SearchRequest(BaseModel):
    query: str = Field(min_length=1, description="Question or keywords to search for")
    notes: list[NoteIn] = Field(default_factory=list)
    top_k: int = Field(default=5, ge=1, le=20)


class Passage(BaseModel):
    note_id: str
    note_title: str
    note_folder: str | None = None
    note_tags: list[str] = Field(default_factory=list)
    text: str
    snippet: str
    score: int
    matched_terms: int
    total_terms: int


class SearchResponse(BaseModel):
    query: str
    terms: list[str]
    total_notes: int
    results: list[Passage]


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
