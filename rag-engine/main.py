import os
import io
import json
import re
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pypdf import PdfReader
from openai import OpenAI
from supabase import create_client, Client
from dotenv import load_dotenv
from sentence_transformers import SentenceTransformer

load_dotenv()

app = FastAPI(title="Project Eklavya - Bilingual RAG & Study Ecosystem")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 1. Groq / OpenAI-Compatible Client
groq_client = OpenAI(
    api_key=os.getenv("OPENAI_API_KEY"),
    base_url=os.getenv("OPENAI_BASE_URL")
)

# 2. Local Multilingual Embedding Model (384 dimensions)
embedding_model = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2")

# 3. Supabase Vector Database Client
supabase_client: Client = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_KEY")
)

# In-memory cache of the latest uploaded chunks for instant study-tool generation
LATEST_CHUNKS_CACHE: Dict[str, List[str]] = {}


def chunk_text(text: str, chunk_size: int = 800, overlap: int = 150) -> List[str]:
    words = text.split()
    chunks = []
    i = 0
    while i < len(words):
        chunk = " ".join(words[i:i + chunk_size])
        chunks.append(chunk)
        i += chunk_size - overlap
    return chunks


def extract_json(raw_text: str) -> Dict[str, Any]:
    """Safely extracts a JSON object from an LLM response."""
    cleaned = re.sub(r"```(?:json)?", "", raw_text).strip().rstrip("`").strip()
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start != -1 and end != -1:
        return json.loads(cleaned[start:end + 1])
    raise ValueError("Valid JSON not found in model output.")


class ChatTurn(BaseModel):
    role: str
    text: str


class QueryRequest(BaseModel):
    user_id: str
    subject: Optional[str] = None
    query: str
    language: Optional[str] = "Auto (Match User)"
    history: Optional[List[ChatTurn]] = []


class ToolRequest(BaseModel):
    user_id: str
    subject: Optional[str] = None
    tool_type: str  # "flashcards" | "quiz" | "career"
    language: Optional[str] = "Hinglish"


@app.get("/")
async def root():
    return {
        "status": "online",
        "service": "Project Eklavya Bilingual RAG Engine",
        "docs_url": "[http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)"
    }


@app.post("/api/upload")
async def upload_document(
    user_id: str = Form(...),
    subject: str = Form(...),
    file: UploadFile = File(...)
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are currently supported.")

    file_bytes = await file.read()
    reader = PdfReader(io.BytesIO(file_bytes))
    extracted_text = ""

    for page in reader.pages:
        page_text = page.extract_text()
        if page_text:
            extracted_text += page_text + "\n"

    if not extracted_text.strip():
        raise HTTPException(status_code=400, detail="Failed to extract readable text from the PDF.")

    chunks = chunk_text(extracted_text)
    LATEST_CHUNKS_CACHE[subject] = chunks
    LATEST_CHUNKS_CACHE["latest"] = chunks

    records = []
    for chunk in chunks:
        vector = embedding_model.encode(chunk).tolist()
        records.append({
            "user_id": user_id,
            "subject": subject,
            "content": chunk,
            "embedding": vector
        })

    supabase_client.table("curriculum_documents").insert(records).execute()

    return {
        "status": "success",
        "filename": file.filename,
        "total_chunks": len(records)
    }


@app.post("/api/query")
async def query_curriculum(payload: QueryRequest):
    query_vector = embedding_model.encode(payload.query).tolist()

    rpc_params = {
        "query_embedding": query_vector,
        "match_count": 4,
        "filter_subject": payload.subject if payload.subject else None
    }

    search_res = supabase_client.rpc("match_curriculum_documents", rpc_params).execute()
    matches = search_res.data or []
    context = "\n---\n".join([item["content"] for item in matches])

    if not context and payload.subject in LATEST_CHUNKS_CACHE:
        context = "\n---\n".join(LATEST_CHUNKS_CACHE[payload.subject][:3])

    lang_instruction = (
        f"Preferred Output Language Mode: {payload.language}. "
        "If set to 'Auto (Match User)', detect whether the student wrote in English, Hindi (Devanagari), or Hinglish, and reply in that exact language."
    )

    system_prompt = (
        "You are 'Eklavya AI', an encouraging, highly knowledgeable 1-on-1 academic mentor for students in India. "
        f"{lang_instruction}\n"
        "Rules:\n"
        "1. Ground your explanation strictly in the provided Context.\n"
        "2. Structure your explanation clearly using short paragraphs, bullet points, and relatable Indian real-world examples.\n"
        "3. Always end your response with a section titled '🎯 Active-Recall Checkpoint:' followed by 1 short conceptual question to test the student."
    )

    messages = [{"role": "system", "content": system_prompt}]

    # Include up to last 4 turns of conversation history so follow-ups like "now in hindi" work seamlessly
    if payload.history:
        for turn in payload.history[-4:]:
            role = "user" if turn.role == "student" else "assistant"
            messages.append({"role": role, "content": turn.text})

    user_message = f"Context from Textbook:\n{context if context else 'Use previous conversation context.'}\n\nStudent Question: {payload.query}"
    messages.append({"role": "user", "content": user_message})

    completion = groq_client.chat.completions.create(
        model=os.getenv("MODEL_RAG_TUTOR", "llama-3.3-70b-versatile"),
        messages=messages,
        temperature=0.4
    )

    return {
        "answer": completion.choices[0].message.content,
        "sources": [item.get("id") for item in matches]
    }


@app.post("/api/study-tools")
async def generate_study_tools(payload: ToolRequest):
    """Generates interactive Flashcards, Adaptive Quizzes, or Career Roadmaps grounded in the uploaded textbook."""
    # Retrieve textbook context from cache or Supabase
    chunks = LATEST_CHUNKS_CACHE.get(payload.subject) or LATEST_CHUNKS_CACHE.get("latest")
    if not chunks:
        seed_vector = embedding_model.encode(f"Main concepts and summary of {payload.subject}").tolist()
        res = supabase_client.rpc("match_curriculum_documents", {
            "query_embedding": seed_vector,
            "match_count": 4,
            "filter_subject": payload.subject if payload.subject else None
        }).execute()
        chunks = [item["content"] for item in (res.data or [])]

    context = "\n---\n".join(chunks[:4]) if chunks else f"General curriculum for {payload.subject}."

    if payload.tool_type == "flashcards":
        prompt = f"""Based strictly on the textbook context below, generate a chapter summary and 5 active-recall flashcards in {payload.language}.
Return ONLY valid JSON matching this exact structure:
{{
  "chapter_title": "Title of the chapter/topic",
  "summary_points": ["Key takeaway 1", "Key takeaway 2", "Key takeaway 3", "Key takeaway 4"],
  "flashcards": [
    {{"front": "Question or concept term", "back": "Clear explanation/answer in {payload.language}", "tag": "Core Concept"}}
  ]
}}

Context:
{context}"""

    elif payload.tool_type == "quiz":
        prompt = f"""Based strictly on the textbook context below, generate a 4-question multiple-choice quiz in {payload.language} to test deep conceptual understanding.
Return ONLY valid JSON matching this exact structure:
{{
  "topic": "Topic Name",
  "questions": [
    {{
      "question": "Clear question text in {payload.language}?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_index": 0,
      "explanation": "Why this option is correct, explained simply in {payload.language}."
    }}
  ]
}}

Context:
{context}"""

    else:  # career & roadmap
        prompt = f"""Based on the academic concepts in the context below (Subject: {payload.subject}), create a personalized learning roadmap and connect these classroom concepts to 3 real-world career paths for Indian students in {payload.language}.
Return ONLY valid JSON matching this exact structure:
{{
  "roadmap_steps": [
    {{"step": "Step 1 Title", "detail": "What to master first and how"}},
    {{"step": "Step 2 Title", "detail": "Practice & application strategy"}},
    {{"step": "Step 3 Title", "detail": "Advanced mastery goal"}}
  ],
  "careers": [
    {{
      "role": "Career Title",
      "relevance": "How this textbook chapter connects to this real-world career in {payload.language}",
      "skills": ["Skill 1", "Skill 2", "Skill 3"],
      "resources": "Free Indian learning platforms (e.g., NPTEL, SWAYAM, UPSC/GATE/Industry prep)"
    }}
  ]
}}

Context:
{context}"""

    completion = groq_client.chat.completions.create(
        model=os.getenv("MODEL_RAG_TUTOR", "llama-3.3-70b-versatile"),
        messages=[
            {"role": "system", "content": "You are an expert educational JSON generator. Output strictly valid JSON with no extra commentary."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.3
    )

    raw_output = completion.choices[0].message.content
    try:
        parsed = extract_json(raw_output)
        return {"status": "success", "data": parsed}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse AI tool output: {str(e)}")