# Project Eklavya: Bilingual GenAI Learning Ecosystem

An inclusive, multilingual (Hindi, English, Hinglish) AI study ecosystem democratizing 1-on-1 mentorship for marginalized communities and Tier-2/Tier-3 students.

---

## Tech Stack
- **Frontend:** Next.js (Web), React Native (Mobile)
- **API Gateway:** Node.js / Express
- **RAG Engine:** Python / FastAPI
- **Vector Database:** Supabase (PostgreSQL with `pgvector` extension)
- **Embedding Model:** HuggingFace `paraphrase-multilingual-MiniLM-L12-v2` (Local, 384 dimensions)
- **LLM Inference:** Groq Cloud API (`openai/gpt-oss-120b`)

---

## Project Structure
```text
├── main.py                  # FastAPI RAG application
├── requirements.txt         # Python dependencies
├── .env.example             # Template environment configuration
├── LICENSE                  # MIT License
├── docs/
│   └── ARCHITECTURE.md      # Detailed system design & Mermaid diagrams
├── sample_data/
│   └── sample_curriculum.txt# Sample evaluation content
└── tests/
    └── test_api.py          # API route & validation test cases
```

---

## Environment Variables Configuration

Copy the template to initialize your configuration:
```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `OPENAI_API_KEY` | Groq / OpenAI-compatible API authentication token |
| `OPENAI_BASE_URL` | Endpoint URL (`https://api.groq.com/openai/v1`) |
| `SUPABASE_URL` | Supabase project REST URL |
| `SUPABASE_KEY` | Supabase `service_role` secret key |
| `MODEL_RAG_TUTOR` | Primary generation model (`openai/gpt-oss-120b`) |

---

## Local Development Setup

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/](https://github.com/)<your-username>/project-eklavya.git
   cd project-eklavya
   ```

2. **Initialize Python virtual environment:**
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Run the server:**
   ```bash
   uvicorn main:app --reload --port 8000
   ```

5. **Access Interactive Docs:** Open `http://localhost:8000/docs` in your browser.