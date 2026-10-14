import os
import io
from typing import List, Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from pydantic import BaseModel
from pypdf import PdfReader
from openai import OpenAI
from supabase import create_client, Client
from dotenv import load_dotenv
from sentence_transformers import SentenceTransformer

load_dotenv()

app = FastAPI(title="EdTech Bilingual RAG Engine")

# 1. Groq Client for Text Generation (Ultra-Fast LLM)
groq_client = OpenAI(
    api_key=os.getenv("OPENAI_API_KEY"),
    base_url=os.getenv("OPENAI_BASE_URL")
)

# 2. Local Embedding Model - UPDATED to Multilingual
# This maps Hindi, English, and Hinglish queries accurately to the PDF text
# It outputs 384 dimensions, so your Supabase VECTOR(384) schema remains intact.
embedding_model = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')

supabase_client: Client = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_KEY")
)

def chunk_text(text: str, chunk_size: int = 800, overlap: int = 150) -> List[str]:
    words = text.split()
    chunks = []
    i = 0
    while i < len(words):
        chunk = " ".join(words[i:i + chunk_size])
        chunks.append(chunk)
        i += chunk_size - overlap
    return chunks

class QueryRequest(BaseModel):
    user_id: str
    subject: Optional[str] = None
    query: str

@app.post("/api/upload")
async def upload_document(
    user_id: str = Form(...),
    subject: str = Form(...),
    file: UploadFile = File(...)
):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are currently supported.")

    file_bytes = await file.read()
    reader = PdfReader(io.BytesIO(file_bytes))
    extracted_text = ""
    for page in reader.pages:
        page_text = page.extract_text()
        if page_text:
            extracted_text += page_text + "\n"

    if not extracted_text.strip():
        raise HTTPException(status_code=400, detail="Failed to extract text from the PDF.")

    chunks = chunk_text(extracted_text)
    records = []
    
    for chunk in chunks:
        # Generate 384-dimensional vector locally using the multilingual model
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
    # Generate vector for user query locally
    query_vector = embedding_model.encode(payload.query).tolist()

    rpc_params = {
        "query_embedding": query_vector,
        "match_count": 4,
        "filter_subject": payload.subject if payload.subject else None
    }
    
    search_res = supabase_client.rpc("match_curriculum_documents", rpc_params).execute()
    matches = search_res.data or []

    context = "\n---\n".join([item["content"] for item in matches])

    # UPDATED System Prompt for dynamic language matching
    system_prompt = (
        "You are an encouraging, highly knowledgeable AI academic mentor. "
        "You are completely fluent in English, Hindi (written in Devanagari or Latin script), and Hinglish. "
        "Your instructions: "
        "1. Detect the language and style the user is speaking in (Pure English, Pure Hindi, or Hinglish) and reply completely in that SAME language. "
        "2. Explain concepts conversationally and clearly based strictly on the provided Context. "
        "3. If the information is not present in the Context, admit it honestly. "
        "4. After explaining, provide 1 short active-recall checkpoint question to test their understanding, matching the user's language."
    )

    user_message = f"Context:\n{context}\n\nStudent Question: {payload.query}"

    # Route conversational generation directly to Groq
    completion = groq_client.chat.completions.create(
        model=os.getenv("MODEL_RAG_TUTOR"),
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message}
        ],
        temperature=0.4
    )

    return {
        "answer": completion.choices[0].message.content,
        "sources": [item["id"] for item in matches]
    }