<div align="center">
  <h1>🏹 Project Eklavya</h1>
  <p><b>Democratizing 1-on-1 AI Mentorship for Tier-2 & Tier-3 Students in India</b></p>
  
  [![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](#)
  [![FastAPI](https://img.shields.io/badge/FastAPI-0.104-009688?logo=fastapi)](#)
  [![Supabase](https://img.shields.io/badge/Supabase-pgvector-3ECF8E?logo=supabase)](#)
  [![Groq](https://img.shields.io/badge/AI-Groq%20Llama%203-F55036)](#)
</div>

---

## 💡 The Problem & The Solution
**The Gap:** Students in India's Tier-2/3 cities often face a harsh language barrier. High-quality educational material is in English, but students think and communicate in Hindi or Hinglish. Static PDFs offer no personalized feedback, and private tutoring is expensive.
**The Solution (SDG 4 & 10):** Eklavya bridges this gap. It is a full-stack, bilingual RAG (Retrieval-Augmented Generation) ecosystem that ingests standard curriculum PDFs and transforms them into an interactive, voice-enabled, and gamified AI mentor that speaks the student's language.

## 🚀 Key Innovations
* 💬 **Bilingual RAG Engine:** Ask questions in Hinglish, Hindi, or English. The AI grounds its answers strictly in the uploaded textbook chunks, completely eliminating hallucinations.
* 🎙️ **Hands-Free Voice Mentorship:** Native Web Speech API integration for real-time speech-to-text and text-to-speech without expensive third-party audio billing.
* 🧠 **Cognitive Active-Recall:** Every explanation ends with a targeted checkpoint question to test retention.
* ⚡ **Auto-Generated Study Tools:** Instantly converts textbook vectors into interactive 3D flashcards and adaptive multiple-choice quizzes.
* 🗺️ **Career Discovery Roadmap:** Connects abstract chapter concepts to real-world Indian career paths and free upskilling resources (NPTEL, SWAYAM).
* 🎮 **Gamified Learning Environment:** Features a built-in Pomodoro focus timer, daily streaks, and an XP progression system secured by Clerk.

## 🏗️ System Architecture & Tech Stack

| Domain | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend** | Next.js (App Router), React, Tailwind CSS | UI/UX, Gamification State, Web Speech APIs |
| **Backend** | Python, FastAPI, Uvicorn | High-performance API routing and PDF ingestion |
| **AI / LLM** | Groq (`llama-3.3-70b-versatile`) | Ultra-low latency bilingual inference |
| **Embeddings** | `sentence-transformers` | Cross-lingual vector mapping (`paraphrase-multilingual`) |
| **Database** | Supabase (PostgreSQL + pgvector) | Persistent vector storage and semantic search |
| **Auth** | Clerk | Secure session management & user profiles |

## ⚙️ Local Setup Instructions

### 1. Start the RAG Engine (Backend)
` ` `bash
cd rag-engine
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
` ` `
*Requires `.env` with: `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `SUPABASE_URL`, `SUPABASE_KEY`*

### 2. Start the Web Client (Frontend)
` ` `bash
cd web-client
npm install
npm run dev
` ` `
*Requires `.env.local` with: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_FASTAPI_URL=http://127.0.0.1:8000`*

## 🔮 Future Roadmap
* **WhatsApp Bot Integration:** Extending the AI mentor to WhatsApp via Twilio for ultra-low bandwidth access.
* **OCR Support:** Allowing students to click pictures of handwritten notes to append to their Supabase vector vault.
* **Multi-Agent Debate:** Two AI personas debating a complex topic to help students understand multiple perspectives.

---
*Built with ❤️ for the Hackathon.*