"use client";

import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { UserButton, SignInButton, useUser } from "@clerk/nextjs";
import {
  BookOpen,
  Mic,
  MicOff,
  Volume2,
  Sparkles,
  UploadCloud,
  Send,
  Flame,
  Trophy,
  Timer,
  Play,
  Pause,
  RotateCcw,
  Languages,
  CheckCircle2,
  Layers,
  BrainCircuit,
  Compass,
  MessageSquare,
  Check,
  X,
  RefreshCw,
  FileText,
  User,
} from "lucide-react";

type TabType = "mentor" | "voice" | "upload" | "flashcards" | "quiz" | "roadmap";
type LangMode = "Hinglish" | "Hindi" | "English";

interface ChatMessage {
  role: "student" | "mentor";
  text: string;
  sourcesCount?: number;
}

interface FlashcardData {
  chapter_title: string;
  summary_points: string[];
  flashcards: { front: string; back: string; tag: string }[];
}

interface QuizData {
  topic: string;
  questions: {
    question: string;
    options: string[];
    correct_index: number;
    explanation: string;
  }[];
}

interface CareerData {
  roadmap_steps: { step: string; detail: string }[];
  careers: {
    role: string;
    relevance: string;
    skills: string[];
    resources: string;
  }[];
}

/** Markdown & Table Formatter with Calm Earthy Styling */
function FormattedMessage({ text }: { text: string }) {
  const parts = text.split(/🎯\s*\**Active-Recall Checkpoint:?\**/i);
  const mainBody = parts[0] || "";
  const checkpoint = parts.length > 1 ? parts[1].trim() : null;

  const renderInline = (line: string) => {
    const segments = line.split(/(\*\*.*?\*\*)/g);
    return segments.map((seg, i) => {
      if (seg.startsWith("**") && seg.endsWith("**")) {
        return (
          <strong key={i} className="font-semibold text-[#1F3327]">
            {seg.slice(2, -2)}
          </strong>
        );
      }
      return <span key={i}>{seg}</span>;
    });
  };

  const lines = mainBody.split("\n");
  const elements: React.ReactNode[] = [];
  let tableRows: string[][] = [];

  const flushTable = (keyPrefix: number) => {
    if (tableRows.length === 0) return;
    const filtered = tableRows.filter(
      (r) => !r.every((cell) => /^[-:\s]+$/.test(cell))
    );
    if (filtered.length > 0) {
      const headers = filtered[0];
      const body = filtered.slice(1);
      elements.push(
        <div
          key={`table-${keyPrefix}`}
          className="my-3 overflow-x-auto rounded-xl border border-[#D9D3C7] shadow-sm bg-white"
        >
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#EBF2EC] text-[#254232]">
              <tr>
                {headers.map((h, idx) => (
                  <th key={idx} className="p-2.5 border-b border-[#D9D3C7] font-semibold">
                    {renderInline(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFEBE4]">
              {body.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-[#FAF8F5]/80">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="p-2.5 text-[#3D3A36]">
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    tableRows = [];
  };

  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();
    if (line.startsWith("|") && line.endsWith("|")) {
      const cells = line.slice(1, -1).split("|").map((c) => c.trim());
      tableRows.push(cells);
      return;
    } else {
      flushTable(idx);
    }

    if (!line) {
      elements.push(<div key={idx} className="h-2" />);
    } else if (line.startsWith("### ")) {
      elements.push(
        <h4 key={idx} className="text-sm font-bold text-[#2E4F3E] mt-3 mb-1">
          {renderInline(line.replace(/^###\s+/, ""))}
        </h4>
      );
    } else if (line.startsWith("## ") || line.startsWith("# ")) {
      elements.push(
        <h3 key={idx} className="text-base font-bold text-[#1E362A] mt-3 mb-1">
          {renderInline(line.replace(/^#+\s+/, ""))}
        </h3>
      );
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(
        <div key={idx} className="flex items-start gap-2 pl-2 my-1 text-[#33302C]">
          <span className="text-[#3F6A54] font-bold">•</span>
          <span className="flex-1">{renderInline(line.slice(2))}</span>
        </div>
      );
    } else {
      elements.push(
        <p key={idx} className="my-1 leading-relaxed text-[#33302C]">
          {renderInline(line)}
        </p>
      );
    }
  });
  flushTable(lines.length);

  return (
    <div className="space-y-2">
      <div>{elements}</div>
      {checkpoint && (
        <div className="mt-3.5 p-3.5 rounded-xl bg-[#EDF4EE] border border-[#C5D9C8] text-[#1D382B]">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#2D5A40] flex items-center gap-1.5 mb-1">
            <span>🎯 Active-Recall Checkpoint</span>
          </div>
          <p className="text-xs font-medium leading-relaxed">
            {renderInline(checkpoint)}
          </p>
        </div>
      )}
    </div>
  );
}

export default function EklavyaPlatform() {
  const { isSignedIn, user } = useUser();

  // Navigation & Language State
  const [activeTab, setActiveTab] = useState<TabType>("mentor");
  const [language, setLanguage] = useState<LangMode>("Hinglish");
  const [subject, setSubject] = useState("History");

  // Gamification & Pomodoro State
  const [xp, setXp] = useState(140);
  const [streak] = useState(5);
  const [pomoSeconds, setPomoSeconds] = useState(25 * 60);
  const [pomoRunning, setPomoRunning] = useState(false);

  // Ingestion & File State
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [uploadedFilesCount, setUploadedFilesCount] = useState(1);

  // Chat State
  const [query, setQuery] = useState("");
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [loadingChat, setLoadingChat] = useState(false);

  // Voice ("Talk to Mentor") State
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceQuery, setVoiceQuery] = useState("");
  const [voiceReply, setVoiceReply] = useState("");
  const [voiceLoading, setVoiceLoading] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Study Tools State
  const [loadingTool, setLoadingTool] = useState(false);
  const [flashcardData, setFlashcardData] = useState<FlashcardData | null>(null);
  const [flippedCards, setFlippedCards] = useState<Record<number, boolean>>({});
  const [quizData, setQuizData] = useState<QuizData | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [careerData, setCareerData] = useState<CareerData | null>(null);

  const API_BASE = "http://127.0.0.1:8000";
  const studentId = user?.id || "student_eklavya_01";
  const voiceLangCode = language === "English" ? "en-IN" : "hi-IN";

  // Pomodoro Timer Hook
  useEffect(() => {
    if (!pomoRunning) return;
    const interval = setInterval(() => {
      setPomoSeconds((prev) => {
        if (prev <= 1) {
          setPomoRunning(false);
          setXp((x) => x + 50);
          return 25 * 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [pomoRunning]);

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // Web Speech API Initialization
  useEffect(() => {
    const SpeechRec =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRec) {
      const rec = new SpeechRec();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = voiceLangCode;

      rec.onstart = () => setIsListening(true);
      rec.onend = () => setIsListening(false);

      rec.onresult = (event: any) => {
        const spoken = event.results[0][0].transcript;
        setVoiceQuery(spoken);
        handleVoiceQuery(spoken);
      };

      recognitionRef.current = rec;
    }
  }, [voiceLangCode]);

  const speakAudio = (text: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    const clean = text.replace(/[*#_`|]/g, "").replace(/🎯.*$/, "").trim();
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = voiceLangCode;
    utterance.rate = 1.0;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  const toggleMic = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition isn't supported in this browser. Please use Chrome or Edge.");
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      window.speechSynthesis.cancel();
      setVoiceQuery("");
      recognitionRef.current.start();
    }
  };

  const handleVoiceQuery = async (queryText: string) => {
    setVoiceLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/api/query`, {
        user_id: studentId,
        subject: subject,
        query: queryText,
        language: language,
      });

      const reply = res.data.answer;
      setVoiceReply(reply);
      speakAudio(reply);
      setXp((prev) => prev + 20);
    } catch {
      setVoiceReply("Could not reach the RAG Engine. Verify Uvicorn is active on port 8000.");
    } finally {
      setVoiceLoading(false);
    }
  };

  // Upload PDF Handler
  const handleUpload = async () => {
    if (!file) {
      setUploadStatus("Please select a PDF document first.");
      return;
    }

    setUploading(true);
    setUploadStatus("Extracting content & generating multilingual embeddings...");

    const formData = new FormData();
    formData.append("user_id", studentId);
    formData.append("subject", subject);
    formData.append("file", file);

    try {
      const res = await axios.post(`${API_BASE}/api/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setUploadStatus(`Ingested "${res.data.filename}" into ${res.data.total_chunks} semantic chunks!`);
      setUploadedFilesCount((c) => c + 1);
      setXp((prev) => prev + 35);
    } catch (err: any) {
      const detail = err?.response?.data?.detail || "Upload failed. Verify FastAPI server.";
      setUploadStatus(`Error: ${detail}`);
    } finally {
      setUploading(false);
    }
  };

  // Chat Submission Handler
  const handleAsk = async (presetText?: string) => {
    const prompt = presetText ?? query;
    if (!prompt.trim() || loadingChat) return;

    const updatedChat: ChatMessage[] = [...chat, { role: "student", text: prompt }];
    setChat(updatedChat);
    setQuery("");
    setLoadingChat(true);

    try {
      const res = await axios.post(`${API_BASE}/api/query`, {
        user_id: studentId,
        subject: subject,
        query: prompt,
        language: language,
        history: chat.slice(-4),
      });

      setChat([
        ...updatedChat,
        {
          role: "mentor",
          text: res.data.answer,
          sourcesCount: res.data.sources?.length || 0,
        },
      ]);
      setXp((prev) => prev + 15);
    } catch {
      setChat([
        ...updatedChat,
        {
          role: "mentor",
          text: "RAG Engine is not reachable. Confirm Uvicorn is running on port 8000.",
        },
      ]);
    } finally {
      setLoadingChat(false);
    }
  };

  // Study Tool Generator
  const generateTool = async (type: "flashcards" | "quiz" | "career") => {
    setLoadingTool(true);
    try {
      const res = await axios.post(`${API_BASE}/api/study-tools`, {
        user_id: studentId,
        subject: subject,
        tool_type: type,
        language: language,
      });

      if (type === "flashcards") {
        setFlashcardData(res.data.data);
        setFlippedCards({});
      } else if (type === "quiz") {
        setQuizData(res.data.data);
        setSelectedAnswers({});
        setQuizSubmitted(false);
      } else {
        setCareerData(res.data.data);
      }
      setXp((x) => x + 25);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingTool(false);
    }
  };

  const getScore = () => {
    if (!quizData) return 0;
    return quizData.questions.reduce((acc, q, idx) => {
      return acc + (selectedAnswers[idx] === q.correct_index ? 1 : 0);
    }, 0);
  };

  return (
    <div className="min-h-screen bg-[#F6F4EE] text-[#24211D] flex flex-col font-sans">
      
      {/* Calm Earthy Top Navigation */}
      <header className="h-16 border-b border-[#E3DDCF] bg-[#FCFBF8]/90 backdrop-blur sticky top-0 z-50 px-4 md:px-8 flex items-center justify-between shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-[#E9EFE9] border border-[#C5D8C7] rounded-xl text-[#284E38]">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base tracking-tight text-[#1C3626]">Project Eklavya</span>
              <span className="text-[10px] uppercase font-semibold tracking-wider px-2 py-0.5 rounded-full bg-[#EBF2EC] text-[#284E38] border border-[#CCDCCD]">
                Bilingual RAG
              </span>
            </div>
            <p className="text-[11px] text-[#696359] hidden sm:block">Democratizing 1-on-1 AI Mentorship</p>
          </div>
        </div>

        {/* Global Widgets: Pomodoro, Streak, XP, Language, Profile */}
        <div className="flex items-center gap-2.5">
          {/* Pomodoro Focus Pill */}
          <div className="hidden sm:flex items-center gap-1.5 bg-[#FAF7F0] border border-[#E3DDCF] px-2.5 py-1 rounded-xl text-xs">
            <Timer className="w-3.5 h-3.5 text-[#B85C38]" />
            <span className="font-mono font-medium text-[#2E2B27]">{formatTimer(pomoSeconds)}</span>
            <button
              onClick={() => setPomoRunning(!pomoRunning)}
              className="text-[#696359] hover:text-[#2E2B27] p-0.5 cursor-pointer"
            >
              {pomoRunning ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            </button>
            <button
              onClick={() => {
                setPomoRunning(false);
                setPomoSeconds(25 * 60);
              }}
              className="text-[#8F887C] hover:text-[#2E2B27] p-0.5 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>

          {/* Streak Indicator */}
          <div className="flex items-center gap-1 bg-[#FAF7F0] border border-[#E3DDCF] px-2.5 py-1 rounded-xl text-xs font-semibold text-[#8C6D23]">
            <Flame className="w-3.5 h-3.5 fill-[#8C6D23]/20" />
            <span>{streak}d</span>
          </div>

          {/* XP Badge */}
          <div className="flex items-center gap-1 bg-[#FAF7F0] border border-[#E3DDCF] px-2.5 py-1 rounded-xl text-xs font-semibold text-[#284E38]">
            <Trophy className="w-3.5 h-3.5 text-[#284E38]" />
            <span>{xp} XP</span>
          </div>

          {/* Functional Language Toggle */}
          <div className="flex items-center gap-1 bg-[#FAF7F0] border border-[#E3DDCF] px-2 py-1 rounded-xl text-xs">
            <Languages className="w-3.5 h-3.5 text-[#284E38]" />
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as LangMode)}
              className="bg-transparent text-xs font-medium text-[#2E2B27] focus:outline-none cursor-pointer"
            >
              <option value="Hinglish">Hinglish</option>
              <option value="Hindi">हिंदी (Hindi)</option>
              <option value="English">English</option>
            </select>
          </div>

          {/* Clerk Auth Component */}
          {isSignedIn ? (
            <UserButton afterSignOutUrl="/" />
          ) : (
            <SignInButton mode="modal">
              <button className="text-xs px-2.5 py-1 bg-[#284E38] hover:bg-[#203F2D] text-white font-medium rounded-lg transition cursor-pointer">
                Sign In
              </button>
            </SignInButton>
          )}
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 md:p-6 space-y-5">
        
        {/* Navigation Tabs (Calm Beige & Sage Pills) */}
        <div className="flex items-center overflow-x-auto gap-2 pb-1 border-b border-[#E3DDCF]/80">
          {[
            { id: "mentor", label: "1-on-1 AI Mentor", icon: MessageSquare },
            { id: "voice", label: "Talk Live (Voice)", icon: Mic },
            { id: "upload", label: "Curriculum Vault", icon: UploadCloud, badge: `${uploadedFilesCount} Docs` },
            { id: "flashcards", label: "Flashcards", icon: Layers },
            { id: "quiz", label: "Quiz Arena", icon: BrainCircuit },
            { id: "roadmap", label: "Career & Roadmap", icon: Compass },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                  active
                    ? "bg-[#284E38] text-white shadow-sm"
                    : "bg-[#EDE8DC]/70 hover:bg-[#E4DDCE] text-[#544F46]"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    active ? "bg-white/20 text-white" : "bg-black/5 text-[#544F46]"
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* VIEW 1: 1-ON-1 BILINGUAL AI MENTOR */}
        {activeTab === "mentor" && (
          <section className="bg-white border border-[#E3DDCF] rounded-2xl shadow-sm flex flex-col h-[560px]">
            <div className="p-4 border-b border-[#EFEBE4] bg-[#FAF8F5] rounded-t-2xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#3D7051]" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-[#2A4B37]">
                  Mentorship Session ({language} Mode)
                </h2>
              </div>
              <span className="text-[11px] font-medium text-[#2E583E] bg-[#E9EFE9] border border-[#CCDCCD] px-2 py-0.5 rounded-md flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Grounded in {subject}
              </span>
            </div>

            {/* Chat Body */}
            <div className="flex-1 p-5 overflow-y-auto space-y-4">
              {chat.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-3 max-w-md mx-auto text-[#6E685E]">
                  <div className="w-12 h-12 rounded-2xl bg-[#EBF2EC] text-[#284E38] flex items-center justify-center">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#25221E]">Start your learning session</h3>
                    <p className="text-xs text-[#736C61] mt-0.5">
                      Ask doubts from your textbook in Hinglish, Hindi, or English.
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-1.5 pt-2">
                    {[
                      "Yeh topic ka main concept simple Hinglish mein samjhao",
                      "Ab isko exam perspective se summarize karo",
                      "Real-world example ke saath explain karo",
                    ].map((prompt, i) => (
                      <button
                        key={i}
                        onClick={() => handleAsk(prompt)}
                        className="text-xs bg-[#FAF7F0] hover:bg-[#F0EBE0] border border-[#E3DDCF] text-[#474239] px-3 py-1.5 rounded-lg transition cursor-pointer"
                      >
                        &ldquo;{prompt}&rdquo;
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                chat.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.role === "student" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed shadow-sm ${
                        msg.role === "student"
                          ? "bg-[#284E38] text-white"
                          : "bg-[#FCFBF8] border border-[#E3DDCF] text-[#24211D]"
                      }`}
                    >
                      {msg.role === "student" ? (
                        <div className="whitespace-pre-wrap">{msg.text}</div>
                      ) : (
                        <FormattedMessage text={msg.text} />
                      )}
                      {msg.role === "mentor" && msg.sourcesCount !== undefined && (
                        <div className="mt-2 pt-2 border-t border-[#EFEBE4] flex items-center justify-between text-[10px] text-[#787165]">
                          <span>📚 Grounded in {msg.sourcesCount} textbook chunks</span>
                          <span className="text-[#284E38] font-semibold">+15 XP Earned</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}

              {loadingChat && (
                <div className="flex justify-start">
                  <div className="bg-[#FAF8F5] border border-[#E3DDCF] text-[#736C61] rounded-2xl px-4 py-2.5 text-xs animate-pulse">
                    Searching curriculum vectors & formulating {language} explanation...
                  </div>
                </div>
              )}
            </div>

            {/* Input Box */}
            <div className="p-3 border-t border-[#EFEBE4] bg-[#FAF8F5] rounded-b-2xl">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAsk()}
                  placeholder={`Ask a question or answer the checkpoint (${language})...`}
                  className="flex-1 px-4 py-2.5 bg-white border border-[#D9D3C7] rounded-xl text-xs text-[#24211D] placeholder-[#9E978C] focus:outline-none focus:border-[#284E38]"
                />
                <button
                  onClick={() => handleAsk()}
                  disabled={loadingChat}
                  className="p-2.5 bg-[#284E38] hover:bg-[#203F2D] disabled:opacity-50 text-white rounded-xl transition cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </section>
        )}

        {/* VIEW 2: TALK TO MENTOR (HANDS-FREE LIVE VOICE) */}
        {activeTab === "voice" && (
          <section className="bg-white border border-[#E3DDCF] rounded-2xl p-8 shadow-sm flex flex-col items-center justify-center text-center min-h-[500px] space-y-6">
            <div className="space-y-1 max-w-md">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#284E38] bg-[#EBF2EC] border border-[#CCDCCD] px-2.5 py-0.5 rounded-full">
                Interactive Voice Mode ({language})
              </span>
              <h2 className="text-xl font-bold text-[#1E3626] pt-1">Talk to Eklavya</h2>
              <p className="text-xs text-[#696359]">
                Tap the microphone and ask your questions out loud. Your mentor will reply in speech and text.
              </p>
            </div>

            {/* Calm Pulsing Orb */}
            <div className="relative flex items-center justify-center my-4">
              {(isListening || isSpeaking) && (
                <div className="absolute w-44 h-44 rounded-full bg-[#284E38]/10 animate-ping" />
              )}
              <button
                onClick={toggleMic}
                disabled={voiceLoading}
                className={`w-32 h-32 rounded-full flex flex-col items-center justify-center transition-all cursor-pointer shadow-md ${
                  isListening
                    ? "bg-[#B85C38] text-white scale-105"
                    : isSpeaking
                    ? "bg-[#284E38] text-white scale-105"
                    : "bg-[#EBF2EC] border-2 border-[#C5D8C7] text-[#284E38] hover:bg-[#DEEADC]"
                }`}
              >
                {isListening ? (
                  <MicOff className="w-10 h-10 animate-pulse" />
                ) : isSpeaking ? (
                  <Volume2 className="w-10 h-10 animate-bounce" />
                ) : (
                  <Mic className="w-10 h-10" />
                )}
                <span className="text-[10px] font-bold mt-1 uppercase tracking-wider">
                  {isListening ? "Listening" : isSpeaking ? "Speaking" : "Tap to Speak"}
                </span>
              </button>
            </div>

            <p className="text-xs font-medium text-[#736C61]">
              {isListening
                ? "Listening now... speak clearly into your mic"
                : voiceLoading
                ? "Searching textbook vectors & synthesizing answer..."
                : isSpeaking
                ? "Eklavya is answering (click orb to interrupt)"
                : "Microphone is idle"}
            </p>

            {/* Spoken Query & Answer Cards */}
            <div className="w-full max-w-xl space-y-3 text-left">
              {voiceQuery && (
                <div className="bg-[#FAF8F5] border border-[#E3DDCF] p-3.5 rounded-xl">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#284E38]">You Asked:</span>
                  <p className="text-xs text-[#2E2B27] mt-0.5 font-medium">{voiceQuery}</p>
                </div>
              )}

              {voiceReply && (
                <div className="bg-[#FAF8F5] border border-[#E3DDCF] p-4 rounded-xl space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#284E38]">Mentor Response:</span>
                  <p className="text-xs text-[#33302C] leading-relaxed whitespace-pre-line">{voiceReply}</p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* VIEW 3: CURRICULUM VAULT (DOCUMENT INGESTION) */}
        {activeTab === "upload" && (
          <section className="bg-white border border-[#E3DDCF] rounded-2xl p-6 shadow-sm space-y-5">
            <div>
              <h2 className="text-base font-bold text-[#1E3626]">Curriculum Vault & Vector Ingestion</h2>
              <p className="text-xs text-[#696359] mt-0.5">
                Upload chapter PDFs to create semantic vector embeddings inside your Supabase knowledge base.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="md:col-span-2 border-2 border-dashed border-[#D9D3C7] bg-[#FAF8F5] rounded-xl p-6 flex flex-col items-center justify-center text-center space-y-3">
                <FileText className="w-10 h-10 text-[#284E38]" />
                <div>
                  <p className="text-xs font-semibold text-[#2E2B27]">Select Textbook PDF</p>
                  <p className="text-[11px] text-[#736C61]">Supports NCERT, state board, or college course material</p>
                </div>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="text-xs text-[#4F4A42] file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#EBF2EC] file:text-[#284E38] hover:file:bg-[#DEEADC] cursor-pointer"
                />
              </div>

              <div className="bg-[#FAF8F5] border border-[#E3DDCF] p-5 rounded-xl space-y-3 flex flex-col justify-between">
                <div className="space-y-3">
                  <label className="text-xs font-semibold text-[#2E2B27] block">Assign Subject</label>
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full bg-white border border-[#D9D3C7] rounded-lg p-2 text-xs text-[#2E2B27] focus:outline-none focus:border-[#284E38]"
                  >
                    <option value="History">History</option>
                    <option value="Science">Science</option>
                    <option value="Mathematics">Mathematics</option>
                    <option value="Computer Science">Computer Science</option>
                  </select>
                </div>

                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="w-full py-2.5 bg-[#284E38] hover:bg-[#203F2D] disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition cursor-pointer flex items-center justify-center gap-2"
                >
                  <UploadCloud className="w-4 h-4" />
                  {uploading ? "Chunking & Vectorizing..." : "Ingest into Vector DB (+35 XP)"}
                </button>
              </div>
            </div>

            {uploadStatus && (
              <div className="p-3 bg-[#FAF8F5] border border-[#D9D3C7] rounded-xl text-xs text-[#3D3A36]">
                {uploadStatus}
              </div>
            )}
          </section>
        )}

        {/* VIEW 4: FLASHCARDS & CHAPTER SUMMARY */}
        {activeTab === "flashcards" && (
          <section className="bg-white border border-[#E3DDCF] rounded-2xl p-6 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#EFEBE4]">
              <div>
                <h2 className="text-base font-bold text-[#1E3626]">Active-Recall Flashcards</h2>
                <p className="text-xs text-[#696359]">Generated from your curriculum vectors in {language}</p>
              </div>
              <button
                onClick={() => generateTool("flashcards")}
                disabled={loadingTool}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-[#284E38] hover:bg-[#203F2D] disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                <RefreshCw className={loadingTool ? "w-3.5 h-3.5 animate-spin" : "w-3.5 h-3.5"} />
                <span>{flashcardData ? "Regenerate" : "Generate Cards (+25 XP)"}</span>
              </button>
            </div>

            {loadingTool && (
              <div className="py-16 text-center text-xs text-[#736C61] animate-pulse">
                Extracting core ideas and creating active-recall cards...
              </div>
            )}

            {!loadingTool && !flashcardData && (
              <div className="py-12 text-center space-y-2 text-[#736C61]">
                <Layers className="w-8 h-8 text-[#284E38] mx-auto" />
                <p className="text-xs font-semibold text-[#2E2B27]">No flashcards generated yet</p>
                <p className="text-[11px] max-w-sm mx-auto">
                  Click &ldquo;Generate Cards&rdquo; to build study cards directly from your uploaded {subject} material.
                </p>
              </div>
            )}

            {!loadingTool && flashcardData && (
              <div className="space-y-4">
                <div className="bg-[#FAF8F5] border border-[#E3DDCF] p-4 rounded-xl space-y-2">
                  <h3 className="text-xs font-bold text-[#284E38]">
                    📌 {flashcardData.chapter_title} — Summary Takeaways
                  </h3>
                  <ul className="space-y-1 text-xs text-[#3D3A36]">
                    {flashcardData.summary_points?.map((pt, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-[#3D7051] font-bold">•</span>
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {flashcardData.flashcards?.map((card, idx) => {
                    const isFlipped = !!flippedCards[idx];
                    return (
                      <div
                        key={idx}
                        onClick={() => {
                          setFlippedCards((prev) => ({ ...prev, [idx]: !prev[idx] }));
                          if (!isFlipped) setXp((x) => x + 5);
                        }}
                        className={`p-4 rounded-xl border transition cursor-pointer min-h-[120px] flex flex-col justify-between ${
                          isFlipped
                            ? "bg-[#EBF2EC] border-[#C5D8C7] text-[#1E3626]"
                            : "bg-[#FAF8F5] border-[#E3DDCF] hover:border-[#CBD8CD] text-[#2E2B27]"
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="font-semibold px-2 py-0.5 rounded bg-white/60 border border-[#D9D3C7]">
                            {card.tag || `Card #${idx + 1}`}
                          </span>
                          <span className="text-[#736C61]">{isFlipped ? "Answer (tap to flip)" : "Question"}</span>
                        </div>
                        <p className="text-xs font-medium my-2">
                          {isFlipped ? card.back : card.front}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        )}

        {/* VIEW 5: QUIZ ARENA */}
        {activeTab === "quiz" && (
          <section className="bg-white border border-[#E3DDCF] rounded-2xl p-6 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#EFEBE4]">
              <div>
                <h2 className="text-base font-bold text-[#1E3626]">Adaptive Retention Arena</h2>
                <p className="text-xs text-[#696359]">Bilingual multiple-choice checkpoint test in {language}</p>
              </div>
              <button
                onClick={() => generateTool("quiz")}
                disabled={loadingTool}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-[#284E38] hover:bg-[#203F2D] disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                <RefreshCw className={loadingTool ? "w-3.5 h-3.5 animate-spin" : "w-3.5 h-3.5"} />
                <span>{quizData ? "New Test" : "Generate Quiz (+25 XP)"}</span>
              </button>
            </div>

            {loadingTool && (
              <div className="py-16 text-center text-xs text-[#736C61] animate-pulse">
                Formulating adaptive questions from curriculum vectors...
              </div>
            )}

            {!loadingTool && !quizData && (
              <div className="py-12 text-center space-y-2 text-[#736C61]">
                <BrainCircuit className="w-8 h-8 text-[#284E38] mx-auto" />
                <p className="text-xs font-semibold text-[#2E2B27]">No quiz loaded</p>
                <p className="text-[11px] max-w-sm mx-auto">
                  Test your understanding of {subject} concepts by clicking &ldquo;Generate Quiz&rdquo;.
                </p>
              </div>
            )}

            {!loadingTool && quizData && (
              <div className="space-y-4">
                {quizData.questions?.map((q, qIdx) => (
                  <div key={qIdx} className="bg-[#FAF8F5] border border-[#E3DDCF] p-4 rounded-xl space-y-2.5">
                    <p className="text-xs font-semibold text-[#22201D]">
                      Q{qIdx + 1}. {q.question}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {q.options.map((opt, oIdx) => {
                        const isSelected = selectedAnswers[qIdx] === oIdx;
                        const isCorrect = q.correct_index === oIdx;

                        let style = "bg-white border-[#D9D3C7] text-[#3D3A36] hover:border-[#284E38]";
                        if (quizSubmitted) {
                          if (isCorrect) style = "bg-[#EBF2EC] border-[#A8C8AB] text-[#1E3626] font-semibold";
                          else if (isSelected) style = "bg-[#FDF0EC] border-[#E8AEA0] text-[#8C3A27]";
                        } else if (isSelected) {
                          style = "bg-[#E9EFE9] border-[#284E38] text-[#1E3626] font-semibold";
                        }

                        return (
                          <button
                            key={oIdx}
                            disabled={quizSubmitted}
                            onClick={() => setSelectedAnswers((prev) => ({ ...prev, [qIdx]: oIdx }))}
                            className={`p-2.5 rounded-lg border text-xs text-left transition flex items-center justify-between cursor-pointer ${style}`}
                          >
                            <span>{opt}</span>
                            {quizSubmitted && isCorrect && <Check className="w-3.5 h-3.5 text-[#284E38]" />}
                            {quizSubmitted && isSelected && !isCorrect && <X className="w-3.5 h-3.5 text-[#B85C38]" />}
                          </button>
                        );
                      })}
                    </div>

                    {quizSubmitted && (
                      <div className="text-[11px] bg-white border border-[#D9D3C7] p-2.5 rounded-lg text-[#474239]">
                        <strong className="text-[#284E38]">Explanation: </strong> {q.explanation}
                      </div>
                    )}
                  </div>
                ))}

                <div className="pt-2 flex items-center justify-between">
                  {!quizSubmitted ? (
                    <button
                      onClick={() => {
                        setQuizSubmitted(true);
                        setXp((x) => x + getScore() * 20);
                      }}
                      className="px-5 py-2 bg-[#284E38] hover:bg-[#203F2D] text-white text-xs font-semibold rounded-xl transition cursor-pointer"
                    >
                      Submit Answers
                    </button>
                  ) : (
                    <div className="text-xs font-bold text-[#284E38]">
                      Result: {getScore()} / {quizData.questions.length} Correct! (+{getScore() * 20} XP)
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        )}

        {/* VIEW 6: CAREER DISCOVERY & STUDY ROADMAP */}
        {activeTab === "roadmap" && (
          <section className="bg-white border border-[#E3DDCF] rounded-2xl p-6 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#EFEBE4]">
              <div>
                <h2 className="text-base font-bold text-[#1E3626]">Career Mapping & Study Roadmap</h2>
                <p className="text-xs text-[#696359]">Connects {subject} concepts to real opportunities for Tier-2/3 students</p>
              </div>
              <button
                onClick={() => generateTool("career")}
                disabled={loadingTool}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-[#284E38] hover:bg-[#203F2D] disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                <RefreshCw className={loadingTool ? "w-3.5 h-3.5 animate-spin" : "w-3.5 h-3.5"} />
                <span>{careerData ? "Refresh Map" : "Generate Roadmap (+25 XP)"}</span>
              </button>
            </div>

            {loadingTool && (
              <div className="py-16 text-center text-xs text-[#736C61] animate-pulse">
                Mapping curriculum to Indian career opportunities & industry certifications...
              </div>
            )}

            {!loadingTool && !careerData && (
              <div className="py-12 text-center space-y-2 text-[#736C61]">
                <Compass className="w-8 h-8 text-[#284E38] mx-auto" />
                <p className="text-xs font-semibold text-[#2E2B27]">No roadmap generated yet</p>
                <p className="text-[11px] max-w-sm mx-auto">
                  Click &ldquo;Generate Roadmap&rdquo; to connect current concepts to jobs and exams.
                </p>
              </div>
            )}

            {!loadingTool && careerData && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-[#284E38] uppercase tracking-wider">
                    🗺️ Mastery Learning Steps
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {careerData.roadmap_steps?.map((step, idx) => (
                      <div key={idx} className="bg-[#FAF8F5] border border-[#E3DDCF] p-3.5 rounded-xl space-y-1">
                        <span className="text-[10px] font-bold text-[#284E38]">Step {idx + 1}</span>
                        <h4 className="text-xs font-bold text-[#22201D]">{step.step}</h4>
                        <p className="text-[11px] text-[#544F46] leading-relaxed">{step.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <h3 className="text-xs font-bold text-[#284E38] uppercase tracking-wider">
                    🚀 Real-World Career Paths
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {careerData.careers?.map((c, idx) => (
                      <div key={idx} className="bg-[#FAF8F5] border border-[#E3DDCF] p-3.5 rounded-xl flex flex-col justify-between space-y-2.5">
                        <div>
                          <h4 className="text-xs font-bold text-[#22201D]">{c.role}</h4>
                          <p className="text-[11px] text-[#544F46] mt-1 leading-relaxed">{c.relevance}</p>
                        </div>
                        <div className="space-y-1.5 pt-2 border-t border-[#EFEBE4]">
                          <div className="flex flex-wrap gap-1">
                            {c.skills?.map((s, sIdx) => (
                              <span key={sIdx} className="text-[9px] bg-[#EBF2EC] text-[#284E38] border border-[#CCDCCD] px-1.5 py-0.5 rounded">
                                {s}
                              </span>
                            ))}
                          </div>
                          <p className="text-[10px] text-[#787165]">
                            <strong className="text-[#3D3A36]">Path:</strong> {c.resources}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

      </main>
    </div>
  );
}