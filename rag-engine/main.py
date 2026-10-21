import os
import io
import json
import re
from datetime import datetime, timezone
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

app = FastAPI(title="Project Eklavya - Full Backend Ecosystem")

# Configure CORS to accept requests from localhost and deployed Next.js app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 1. API CLIENTS & MODELS ---
groq_client = OpenAI(
    api_key=os.getenv("OPENAI_API_KEY"),
    base_url=os.getenv("OPENAI_BASE_URL")
)

embedding_model = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2")

supabase_client: Client = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_KEY")
)

LATEST_CHUNKS_CACHE: Dict[str, List[str]] = {}

# --- 2. HELPER FUNCTIONS ---
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
    cleaned = re.sub(r"```(?:json)?", "", raw_text).strip().rstrip("`").strip()
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start != -1 and end != -1:
        return json.loads(cleaned[start:end + 1])
    raise ValueError("Valid JSON not found in model output.")

def clean_markdown(text: str) -> str:
    """Strips raw markdown symbols (*, #, `) so the UI displays clean plain text."""
    text = re.sub(r'\*\*(.*?)\*\*', r'\1', text)
    text = re.sub(r'\*(.*?)\*', r'\1', text)
    text = re.sub(r'#{1,6}\s?', '', text)
    text = re.sub(r'`(.*?)`', r'\1', text)
    return text

# --- 3. PYDANTIC MODELS ---
class ChatTurn(BaseModel):
    role: str
    text: str

class QueryRequest(BaseModel):
    user_id: str
    subject: Optional[str] = None
    doc_id: Optional[str] = None
    query: str
    language: Optional[str] = "Auto (Match User)"
    history: Optional[List[ChatTurn]] = []

class ToolRequest(BaseModel):
    user_id: str
    subject: Optional[str] = None
    doc_id: Optional[str] = None
    tool_type: str  
    language: Optional[str] = "Hinglish"

class UserSync(BaseModel):
    user_id: str
    name: str

class OnboardingData(BaseModel):
    user_id: str
    class_grade: str  
    subjects: List[str]

class RenameDoc(BaseModel):
    custom_name: str


# --- 4. CORE ENDPOINTS ---

@app.get("/")
async def root():
    return {"status": "online", "service": "Project Eklavya RAG & DB Engine"}

# --- USER PROFILE & GAMIFICATION ---
@app.post("/api/user/sync")
async def sync_user_profile(payload: UserSync):
    """Fires on login to sync Clerk user, calculate streaks, and return profile."""
    res = supabase_client.table("profiles").select("*").eq("user_id", payload.user_id).execute()
    now = datetime.now(timezone.utc)
    
    if not res.data:
        new_profile = {
            "user_id": payload.user_id,
            "name": payload.name,
            "xp": 150,
            "streak": 1,
            "last_active": now.isoformat(),
            "subjects": [],
            "class_grade": "Not Specified"
        }
        supabase_client.table("profiles").insert(new_profile).execute()
        return {"status": "new", "profile": new_profile}
    
    profile = res.data[0]
    last_active = datetime.fromisoformat(profile["last_active"].replace("Z", "+00:00"))
    days_diff = (now.date() - last_active.date()).days
    
    if days_diff == 1:
        profile["streak"] += 1
    elif days_diff > 1:
        profile["streak"] = 1
        
    profile["last_active"] = now.isoformat()
    supabase_client.table("profiles").update({
        "streak": profile["streak"],
        "last_active": profile["last_active"]
    }).eq("user_id", payload.user_id).execute()
    
    return {"status": "returning", "profile": profile}

@app.post("/api/user/onboard")
async def update_user_subjects(payload: OnboardingData):
    """Saves user class and subjects during onboarding step."""
    supabase_client.table("profiles").update({
        "class_grade": payload.class_grade,
        "subjects": payload.subjects
    }).eq("user_id", payload.user_id).execute()
    return {"status": "success"}


# --- DOCUMENT MANAGEMENT & INGESTION ---
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
    extracted_text = "".join([page.extract_text() or "" for page in reader.pages])

    if not extracted_text.strip():
        raise HTTPException(status_code=400, detail="Failed to extract readable text.")

    # BULLETPROOF FAILSAFE: Create profile if the frontend context failed to sync it
    profile_check = supabase_client.table("profiles").select("user_id").eq("user_id", user_id).execute()
    if not profile_check.data:
        supabase_client.table("profiles").insert({
            "user_id": user_id,
            "name": "Student",
            "xp": 150,
            "streak": 1,
            "subjects": [subject],
            "class_grade": "Not Specified"
        }).execute()

    # 1. Save Reference to User's Vault FIRST to generate the UUID
    doc_res = supabase_client.table("user_documents").insert({
        "user_id": user_id,
        "filename": file.filename,
        "custom_name": file.filename,
        "subject": subject
    }).execute()
    new_doc_id = doc_res.data[0]["id"]

    # 2. Chunk and Vectorize
    chunks = chunk_text(extracted_text)
    LATEST_CHUNKS_CACHE[subject] = chunks
    LATEST_CHUNKS_CACHE["latest"] = chunks

    records = []
    for chunk in chunks:
        vector = embedding_model.encode(chunk).tolist()
        records.append({
            "user_id": user_id,
            "subject": subject,
            "doc_id": new_doc_id,
            "content": chunk,
            "embedding": vector
        })
    
    # Batch insert vectors
    supabase_client.table("curriculum_documents").insert(records).execute()

    return {
        "status": "success",
        "filename": file.filename,
        "doc_id": new_doc_id,
        "total_chunks": len(records)
    }

@app.get("/api/documents/{user_id}")
async def get_user_documents(user_id: str):
    """Fetches all PDFs uploaded by a specific user."""
    res = supabase_client.table("user_documents").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
    return {"documents": res.data or []}

@app.patch("/api/documents/{doc_id}")
async def rename_document(doc_id: str, payload: RenameDoc):
    """Allows a user to rename a document in their vault."""
    supabase_client.table("user_documents").update({"custom_name": payload.custom_name}).eq("id", doc_id).execute()
    return {"status": "success"}


# --- AI RAG QUERY ENGINE ---
@app.post("/api/query")
async def query_curriculum(payload: QueryRequest):
    query_vector = embedding_model.encode(payload.query).tolist()

    rpc_params = {
        "query_embedding": query_vector,
        "match_count": 4,
        "filter_subject": payload.subject if payload.subject else None,
        "filter_doc_id": payload.doc_id if payload.doc_id else None
    }

    search_res = supabase_client.rpc("match_curriculum_documents", rpc_params).execute()
    matches = search_res.data or []
    context = "\n---\n".join([item["content"] for item in matches])

    if not context and payload.subject in LATEST_CHUNKS_CACHE:
        context = "\n---\n".join(LATEST_CHUNKS_CACHE[payload.subject][:3])

    lang_instruction = (
        f"Preferred Output Language Mode: {payload.language}. "
        "If Auto, detect whether the student wrote in English, Hindi, or Hinglish."
    )

    system_prompt = (
        "You are 'Eklavya AI', an encouraging 1-on-1 academic mentor for Indian students. "
        f"{lang_instruction}\n"
        "Rules:\n"
        "1. Ground your explanation strictly in the Context.\n"
        "2. Format your response clearly in PLAIN TEXT. DO NOT use markdown symbols like asterisks (**) or hashes (#). Use standard dashes (-) for lists.\n"
        "3. Always end with a section titled '🎯 Active-Recall Checkpoint:' followed by 1 short question."
    )

    messages = [{"role": "system", "content": system_prompt}]

    if payload.history:
        for turn in payload.history[-4:]:
            role = "user" if turn.role == "student" else "assistant"
            messages.append({"role": role, "content": turn.text})

    user_message = f"Context from Textbook:\n{context if context else 'Use previous conversation.'}\n\nStudent Question: {payload.query}"
    messages.append({"role": "user", "content": user_message})

    completion = groq_client.chat.completions.create(
        model=os.getenv("MODEL_RAG_TUTOR", "llama-3.3-70b-versatile"),
        messages=messages,
        temperature=0.4
    )
    
    raw_answer = completion.choices[0].message.content
    clean_answer = clean_markdown(raw_answer)

    return {
        "answer": clean_answer,
        "sources": [item.get("id") for item in matches]
    }


# --- STUDY TOOLS ENGINE ---
@app.post("/api/study-tools")
async def generate_study_tools(payload: ToolRequest):
    chunks = LATEST_CHUNKS_CACHE.get(payload.subject) or LATEST_CHUNKS_CACHE.get("latest")
    
    # Force DB search if a specific document is requested or cache is empty
    if not chunks or payload.doc_id:
        seed_vector = embedding_model.encode(f"Main concepts and summary of {payload.subject}").tolist()
        res = supabase_client.rpc("match_curriculum_documents", {
            "query_embedding": seed_vector,
            "match_count": 4,
            "filter_subject": payload.subject if payload.subject else None,
            "filter_doc_id": payload.doc_id if payload.doc_id else None
        }).execute()
        chunks = [item["content"] for item in (res.data or [])]

    context = "\n---\n".join(chunks[:4]) if chunks else f"General curriculum for {payload.subject}."

    if payload.tool_type == "flashcards":
        prompt = f"""Based on the context, generate a chapter summary and 5 active-recall flashcards in {payload.language}. Return ONLY valid JSON:
{{
  "chapter_title": "Title",
  "summary_points": ["Point 1", "Point 2"],
  "flashcards": [
    {{"front": "Question", "back": "Answer in {payload.language}", "tag": "Concept"}}
  ]
}}
Context: {context}"""

    elif payload.tool_type == "quiz":
        prompt = f"""Based on the context, generate a 4-question multiple-choice quiz in {payload.language}. Return ONLY valid JSON:
{{
  "topic": "Topic",
  "questions": [
    {{
      "question": "Question text?",
      "options": ["A", "B", "C", "D"],
      "correct_index": 0,
      "explanation": "Why correct in {payload.language}."
    }}
  ]
}}
Context: {context}"""

    else:
        prompt = f"""Based on the context (Subject: {payload.subject}), create a learning roadmap and connect it to 3 Indian career paths in {payload.language}. Return ONLY valid JSON:
{{
  "roadmap_steps": [
    {{"step": "Step 1", "detail": "Details"}}
  ],
  "careers": [
    {{
      "role": "Career",
      "relevance": "Relevance",
      "skills": ["Skill 1"],
      "resources": "Free resources"
    }}
  ]
}}
Context: {context}"""

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