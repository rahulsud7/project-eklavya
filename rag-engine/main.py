import os
import io
import json
import re
import requests
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pypdf import PdfReader
from openai import OpenAI
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Project Eklavya - Lightweight Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 1. API CLIENTS ---
groq_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"), base_url=os.getenv("OPENAI_BASE_URL"))
supabase_client: Client = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

LATEST_CHUNKS_CACHE: Dict[str, List[str]] = {}

# --- 2. HUGGING FACE INFERENCE API (Replaces local SentenceTransformers) ---
HF_TOKEN = os.getenv("HF_TOKEN")
HF_API_URL = "https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"

def get_embedding(text: str) -> List[float]:
    """Fetches embeddings from Hugging Face's free cloud API."""
    headers = {"Authorization": f"Bearer {HF_TOKEN}"}
    response = requests.post(HF_API_URL, headers=headers, json={"inputs": text})
    if response.status_code != 200:
        raise HTTPException(status_code=500, detail=f"HF Embedding API failed: {response.text}")
    
    # The API returns a list of floats (the vector)
    result = response.json()
    if isinstance(result, list) and len(result) > 0 and isinstance(result[0], list):
        return result[0] # Handle nested lists if batch format is returned
    return result

# --- 3. HELPER FUNCTIONS ---
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
    raise ValueError("Valid JSON not found.")

def clean_markdown(text: str) -> str:
    text = re.sub(r'\*\*(.*?)\*\*', r'\1', text)
    text = re.sub(r'\*(.*?)\*', r'\1', text)
    text = re.sub(r'#{1,6}\s?', '', text)
    text = re.sub(r'`(.*?)`', r'\1', text)
    return text

# --- 4. PYDANTIC MODELS ---
class ChatTurn(BaseModel): role: str; text: str
class QueryRequest(BaseModel): user_id: str; subject: Optional[str] = None; doc_id: Optional[str] = None; query: str; language: Optional[str] = "Auto (Match User)"; history: Optional[List[ChatTurn]] = []
class ToolRequest(BaseModel): user_id: str; subject: Optional[str] = None; doc_id: Optional[str] = None; tool_type: str; language: Optional[str] = "Hinglish"
class UserSync(BaseModel): user_id: str; name: str
class OnboardingData(BaseModel): user_id: str; class_grade: str; course_type: str; board: str; subjects: List[str]
class RenameDoc(BaseModel): custom_name: str


# --- 5. CORE ENDPOINTS ---

@app.get("/")
async def root(): return {"status": "online", "service": "Eklavya API"}

@app.post("/api/user/sync")
async def sync_user_profile(payload: UserSync):
    res = supabase_client.table("profiles").select("*").eq("user_id", payload.user_id).execute()
    now = datetime.now(timezone.utc)
    if not res.data:
        new_profile = {"user_id": payload.user_id, "name": payload.name, "xp": 150, "streak": 1, "last_active": now.isoformat(), "subjects": [], "class_grade": "Not Specified", "course_type": "Not Specified", "board": "Not Specified"}
        supabase_client.table("profiles").insert(new_profile).execute()
        return {"status": "new", "profile": new_profile}
    
    profile = res.data[0]
    last_active = datetime.fromisoformat(profile["last_active"].replace("Z", "+00:00"))
    days_diff = (now.date() - last_active.date()).days
    if days_diff == 1: profile["streak"] += 1
    elif days_diff > 1: profile["streak"] = 1
        
    profile["last_active"] = now.isoformat()
    supabase_client.table("profiles").update({"streak": profile["streak"], "last_active": profile["last_active"]}).eq("user_id", payload.user_id).execute()
    return {"status": "returning", "profile": profile}

@app.post("/api/user/onboard")
async def update_user_subjects(payload: OnboardingData):
    supabase_client.table("profiles").update({"class_grade": payload.class_grade, "course_type": payload.course_type, "board": payload.board, "subjects": payload.subjects}).eq("user_id", payload.user_id).execute()
    return {"status": "success"}

@app.post("/api/upload")
async def upload_document(user_id: str = Form(...), subject: str = Form(...), file: UploadFile = File(...)):
    file_bytes = await file.read()
    reader = PdfReader(io.BytesIO(file_bytes))
    extracted_text = "".join([page.extract_text() or "" for page in reader.pages])

    profile_check = supabase_client.table("profiles").select("user_id").eq("user_id", user_id).execute()
    if not profile_check.data:
        supabase_client.table("profiles").insert({"user_id": user_id, "name": "Student", "xp": 150, "streak": 1, "subjects": [subject], "class_grade": "Not Specified", "course_type": "Not Specified", "board": "Not Specified"}).execute()

    doc_res = supabase_client.table("user_documents").insert({"user_id": user_id, "filename": file.filename, "custom_name": file.filename, "subject": subject}).execute()
    new_doc_id = doc_res.data[0]["id"]

    chunks = chunk_text(extracted_text)
    LATEST_CHUNKS_CACHE[subject] = chunks
    LATEST_CHUNKS_CACHE["latest"] = chunks

    # Use the Hugging Face API to vectorize the chunks
    records = []
    for chunk in chunks:
        vector = get_embedding(chunk)
        records.append({"user_id": user_id, "subject": subject, "doc_id": new_doc_id, "content": chunk, "embedding": vector})
    
    supabase_client.table("curriculum_documents").insert(records).execute()
    return {"status": "success", "filename": file.filename, "doc_id": new_doc_id, "total_chunks": len(records)}

@app.get("/api/documents/{user_id}")
async def get_user_documents(user_id: str):
    res = supabase_client.table("user_documents").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
    return {"documents": res.data or []}

@app.patch("/api/documents/{doc_id}")
async def rename_document(doc_id: str, payload: RenameDoc):
    supabase_client.table("user_documents").update({"custom_name": payload.custom_name}).eq("id", doc_id).execute()
    return {"status": "success"}

@app.post("/api/query")
async def query_curriculum(payload: QueryRequest):
    # Use HF API to vectorize the query
    query_vector = get_embedding(payload.query)
    
    rpc_params = {"query_embedding": query_vector, "match_count": 4, "filter_subject": payload.subject if payload.subject else None, "filter_doc_id": payload.doc_id if payload.doc_id else None}
    search_res = supabase_client.rpc("match_curriculum_documents", rpc_params).execute()
    matches = search_res.data or []
    context = "\n---\n".join([item["content"] for item in matches])
    if not context and payload.subject in LATEST_CHUNKS_CACHE: context = "\n---\n".join(LATEST_CHUNKS_CACHE[payload.subject][:3])

    system_prompt = (
        "You are 'Eklavya AI', an encouraging 1-on-1 academic mentor for Indian students. "
        f"Preferred Output Language Mode: {payload.language}\n"
        "Rules:\n"
        "1. Ground your explanation strictly in the Context.\n"
        "2. Format your response beautifully using Markdown. Use **bold** for key terms and bullet points for lists.\n"
        "3. Always end with a section titled '🎯 **Active-Recall Checkpoint**' followed by 1 short question."
    )

    messages = [{"role": "system", "content": system_prompt}]
    if payload.history:
        for turn in payload.history[-4:]: messages.append({"role": "user" if turn.role == "student" else "assistant", "content": turn.text})
    messages.append({"role": "user", "content": f"Context from Textbook:\n{context if context else 'Use previous conversation.'}\n\nStudent Question: {payload.query}"})

    completion = groq_client.chat.completions.create(model=os.getenv("MODEL_RAG_TUTOR", "llama-3.3-70b-versatile"), messages=messages, temperature=0.4)
    return {"answer": completion.choices[0].message.content, "sources": [item.get("id") for item in matches]}

@app.post("/api/study-tools")
async def generate_study_tools(payload: ToolRequest):
    chunks = LATEST_CHUNKS_CACHE.get(payload.subject) or LATEST_CHUNKS_CACHE.get("latest")
    if not chunks or payload.doc_id:
        # Use HF API to vectorize the seed
        seed_vector = get_embedding(f"Main concepts and summary of {payload.subject}")
        res = supabase_client.rpc("match_curriculum_documents", {"query_embedding": seed_vector, "match_count": 4, "filter_subject": payload.subject if payload.subject else None, "filter_doc_id": payload.doc_id if payload.doc_id else None}).execute()
        chunks = [item["content"] for item in (res.data or [])]
    context = "\n---\n".join(chunks[:4]) if chunks else f"General curriculum for {payload.subject}."
    
    if payload.tool_type == "flashcards":
        prompt = f'Based on the context, generate a chapter summary and 5 active-recall flashcards in {payload.language}. Return ONLY valid JSON:\n{{"chapter_title": "Title", "summary_points": ["Point 1", "Point 2"], "flashcards": [{{"front": "Question", "back": "Answer in {payload.language}", "tag": "Concept"}}]}}\nContext: {context}'
    elif payload.tool_type == "quiz":
        prompt = f'Based on the context, generate a 4-question multiple-choice quiz in {payload.language}. Return ONLY valid JSON:\n{{"topic": "Topic", "questions": [{{"question": "Question text?", "options": ["A", "B", "C", "D"], "correct_index": 0, "explanation": "Why correct in {payload.language}."}}]}}\nContext: {context}'
    else:
        prompt = f'Based on the context (Subject: {payload.subject}), create a learning roadmap and connect it to 3 Indian career paths in {payload.language}. Return ONLY valid JSON:\n{{"roadmap_steps": [{{"step": "Step 1", "detail": "Details"}}], "careers": [{{"role": "Career", "relevance": "Relevance", "skills": ["Skill 1"], "resources": "Free resources"}}]}}\nContext: {context}'

    completion = groq_client.chat.completions.create(model=os.getenv("MODEL_RAG_TUTOR", "llama-3.3-70b-versatile"), messages=[{"role": "system", "content": "You are an expert educational JSON generator. Output strictly valid JSON with no extra commentary."}, {"role": "user", "content": prompt}], temperature=0.3)
    try: return {"status": "success", "data": extract_json(completion.choices[0].message.content)}
    except Exception as e: raise HTTPException(status_code=500, detail=f"Failed to parse AI tool output: {str(e)}")