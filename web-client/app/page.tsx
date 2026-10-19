"use client";

import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  UploadCloud,
  Send,
  BookOpen,
  CheckCircle2,
  Sparkles,
  Languages,
  Flame,
  Trophy,
  Timer,
  Play,
  Pause,
  RotateCcw,
  Layers,
  BrainCircuit,
  Compass,
  MessageSquare,
  Check,
  X,
  RefreshCw,
} from "lucide-react";

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

/** Custom Markdown & Table Renderer */
function FormattedMessage({ text }: { text: string }) {
  const parts = text.split(/🎯\s*\**Active-Recall Checkpoint:?\**/i);
  const mainBody = parts[0] || "";
  const checkpoint = parts.length > 1 ? parts[1].trim() : null;

  const renderInline = (line: string) => {
    const segments = line.split(/(\*\*.*?\*\*)/g);
    return segments.map((seg, i) => {
      if (seg.startsWith("**") && seg.endsWith("**")) {
        return (
          <strong key={i} className="font-semibold text-white">
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
          className="my-3 overflow-x-auto rounded-xl border border-slate-700"
        >
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-800/90 text-indigo-300">
              <tr>
                {headers.map((h, idx) => (
                  <th
                    key={idx}
                    className="p-2.5 border-b border-slate-700 font-semibold"
                  >
                    {renderInline(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-900/60">
              {body.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-slate-800/40">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="p-2.5 text-slate-300">
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
      const cells = line
        .slice(1, -1)
        .split("|")
        .map((c) => c.trim());
      tableRows.push(cells);
      return;
    } else {
      flushTable(idx);
    }

    if (!line) {
      elements.push(<div key={idx} className="h-2" />);
    } else if (line.startsWith("### ")) {
      elements.push(
        <h4 key={idx} className="text-sm font-bold text-indigo-300 mt-3 mb-1">
          {renderInline(line.replace(/^###\s+/, ""))}
        </h4>
      );
    } else if (line.startsWith("## ") || line.startsWith("# ")) {
      elements.push(
        <h3 key={idx} className="text-base font-bold text-white mt-3 mb-1">
          {renderInline(line.replace(/^#+\s+/, ""))}
        </h3>
      );
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(
        <div key={idx} className="flex items-start gap-2 pl-2 my-1">
          <span className="text-indigo-400 mt-1">•</span>
          <span className="flex-1">{renderInline(line.slice(2))}</span>
        </div>
      );
    } else {
      elements.push(
        <p key={idx} className="my-1 leading-relaxed">
          {renderInline(line)}
        </p>
      );
    }
  });
  flushTable(lines.length);

  return (
    <div className="space-y-3">
      <div>{elements}</div>
      {checkpoint && (
        <div className="mt-4 p-3.5 rounded-xl bg-indigo-950/60 border border-indigo-500/40">
          <div className="text-xs font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5 mb-1">
            <span>🎯 Active-Recall Checkpoint</span>
          </div>
          <p className="text-sm text-indigo-100 font-medium">
            {renderInline(checkpoint)}
          </p>
        </div>
      )}
    </div>
  );
}

export default function EklavyaMentor() {
  // Core state
  const [activeTab, setActiveTab] = useState("mentor" as "mentor" | "flashcards" | "quiz" | "career");
  const [subject, setSubject] = useState("History");
  const [language, setLanguage] = useState("Hinglish");
  const [file, setFile] = useState(null as File | null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");

  // Gamification & Pomodoro state
  const [xp, setXp] = useState(120);
  const [streak] = useState(5);
  const [pomoSeconds, setPomoSeconds] = useState(25 * 60);
  const [pomoRunning, setPomoRunning] = useState(false);

  // Chat state
  const [query, setQuery] = useState("");
  const [chat, setChat] = useState([] as ChatMessage[]);
  const [loadingChat, setLoadingChat] = useState(false);

  // Study Tools state
  const [loadingTool, setLoadingTool] = useState(false);
  const [flashcardData, setFlashcardData] = useState(null as FlashcardData | null);
  const [flippedCards, setFlippedCards] = useState({} as Record<number, boolean>);

  const [quizData, setQuizData] = useState(null as QuizData | null);
  const [selectedAnswers, setSelectedAnswers] = useState({} as Record<number, number>);
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  const [careerData, setCareerData] = useState(null as CareerData | null);

  const MOCK_USER_ID = "student_hr_001";
  const API_BASE = "http://127.0.0.1:8000";

  // Pomodoro Timer Effect
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

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const handleUpload = async () => {
    if (!file) {
      setUploadStatus("Please select a PDF file first.");
      return;
    }

    setUploading(true);
    setUploadStatus("Extracting text & generating multilingual vectors...");

    const formData = new FormData();
    formData.append("user_id", MOCK_USER_ID);
    formData.append("subject", subject);
    formData.append("file", file);

    try {
      const res = await axios.post(`${API_BASE}/api/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setUploadStatus(
        `✅ Ingested "${res.data.filename}" into ${res.data.total_chunks} semantic chunks! (+30 XP)`
      );
      setXp((prev) => prev + 30);
    } catch (error: any) {
      const detail =
        error?.response?.data?.detail ||
        "Upload failed. Ensure FastAPI is running on port 8000.";
      setUploadStatus(`❌ ${detail}`);
    } finally {
      setUploading(false);
    }
  };

  const handleAsk = async (customQuery?: string) => {
    const questionText = customQuery ?? query;
    if (!questionText.trim() || loadingChat) return;

    const updatedChat: ChatMessage[] = [
      ...chat,
      { role: "student", text: questionText },
    ];
    setChat(updatedChat);
    setQuery("");
    setLoadingChat(true);

    try {
      const res = await axios.post(`${API_BASE}/api/query`, {
        user_id: MOCK_USER_ID,
        subject: subject,
        query: questionText,
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
          text: "⚠️ Could not reach the RAG Engine on http://127.0.0.1:8000. Make sure Uvicorn is running.",
        },
      ]);
    } finally {
      setLoadingChat(false);
    }
  };

  const generateTool = async (toolType: "flashcards" | "quiz" | "career") => {
    setLoadingTool(true);
    try {
      const res = await axios.post(`${API_BASE}/api/study-tools`, {
        user_id: MOCK_USER_ID,
        subject: subject,
        tool_type: toolType,
        language: language === "Auto (Match User)" ? "Hinglish" : language,
      });

      if (toolType === "flashcards") {
        setFlashcardData(res.data.data);
        setFlippedCards({});
      } else if (toolType === "quiz") {
        setQuizData(res.data.data);
        setSelectedAnswers({});
        setQuizSubmitted(false);
      } else {
        setCareerData(res.data.data);
      }
      setXp((prev) => prev + 20);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingTool(false);
    }
  };

  const calculateQuizScore = () => {
    if (!quizData) return 0;
    return quizData.questions.reduce((acc, q, idx) => {
      return acc + (selectedAnswers[idx] === q.correct_index ? 1 : 0);
    }, 0);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Top Gamified Navigation Bar */}
        <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-5 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-indigo-600/20 border border-indigo-500/30 rounded-xl">
              <BookOpen className="w-7 h-7 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-white">
                  Project Eklavya
                </h1>
                <span className="text-[11px] font-semibold uppercase px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  SDG 4 & 10
                </span>
              </div>
              <p className="text-sm text-slate-400">
                Bilingual GenAI & RAG 1-on-1 Mentorship Ecosystem
              </p>
            </div>
          </div>

          {/* Gamification & Pomodoro Widgets */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Pomodoro Focus Widget */}
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl text-xs">
              <Timer className="w-4 h-4 text-rose-400" />
              <span className="font-mono font-semibold text-white">
                {formatTime(pomoSeconds)}
              </span>
              <button
                onClick={() => setPomoRunning(!pomoRunning)}
                className="p-1 hover:bg-slate-800 rounded text-slate-300 cursor-pointer"
                title={pomoRunning ? "Pause Focus Session" : "Start Focus Session"}
              >
                {pomoRunning ? (
                  <Pause className="w-3.5 h-3.5" />
                ) : (
                  <Play className="w-3.5 h-3.5" />
                )}
              </button>
              <button
                onClick={() => {
                  setPomoRunning(false);
                  setPomoSeconds(25 * 60);
                }}
                className="p-1 hover:bg-slate-800 rounded text-slate-400 cursor-pointer"
                title="Reset Timer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Streak Badge */}
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl text-xs font-medium text-amber-400">
              <Flame className="w-4 h-4" />
              <span>{streak} Day Streak</span>
            </div>

            {/* XP Badge */}
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl text-xs font-medium text-emerald-400">
              <Trophy className="w-4 h-4" />
              <span>{xp} XP</span>
            </div>

            {/* Language Selector */}
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl text-xs">
              <Languages className="w-4 h-4 text-indigo-400" />
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="bg-transparent text-slate-200 font-medium focus:outline-none cursor-pointer"
              >
                <option value="Hinglish" className="bg-slate-900">
                  Hinglish
                </option>
                <option value="Hindi (Devanagari)" className="bg-slate-900">
                  हिंदी (Hindi)
                </option>
                <option value="English" className="bg-slate-900">
                  English
                </option>
                <option value="Auto (Match User)" className="bg-slate-900">
                  Auto-Detect
                </option>
              </select>
            </div>
          </div>
        </header>

        {/* Step 1: Upload Curriculum PDF */}
        <section className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl shadow-lg space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-indigo-600 text-xs flex items-center justify-center font-bold">
                1
              </span>
              Upload Textbook / Notes (PDF)
            </h2>

            <div className="flex items-center space-x-2">
              <label className="text-xs text-slate-400">Subject:</label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="History">History</option>
                <option value="Science">Science</option>
                <option value="Mathematics">Mathematics</option>
                <option value="Computer Science">Computer Science</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <input
              type="file"
              accept=".pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="flex-1 text-xs text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-medium file:bg-indigo-600/20 file:text-indigo-300 hover:file:bg-indigo-600/30 cursor-pointer bg-slate-950 border border-slate-800 rounded-xl p-1.5"
            />
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="flex items-center justify-center px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition cursor-pointer"
            >
              <UploadCloud className="w-4 h-4 mr-2" />
              {uploading ? "Vectorizing..." : "Ingest PDF"}
            </button>
          </div>

          {uploadStatus && (
            <p className="text-xs text-slate-300 bg-slate-950/90 border border-slate-800 px-3.5 py-2 rounded-lg">
              {uploadStatus}
            </p>
          )}
        </section>

        {/* Feature Navigation Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { id: "mentor", label: "1-on-1 AI Mentor", icon: MessageSquare },
            { id: "flashcards", label: "Flashcards & Summary", icon: Layers },
            { id: "quiz", label: "Adaptive Quiz Gate", icon: BrainCircuit },
            { id: "career", label: "Career & Roadmap", icon: Compass },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={
                  active
                    ? "flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-semibold border transition cursor-pointer bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-950/50"
                    : "flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-semibold border transition cursor-pointer bg-slate-900/70 text-slate-400 border-slate-800 hover:bg-slate-900 hover:text-slate-200"
                }
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* TAB 1: 1-ON-1 BILINGUAL AI MENTOR */}
        {activeTab === "mentor" && (
          <section className="bg-slate-900/80 border border-slate-800 rounded-2xl shadow-lg flex flex-col h-[540px]">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-indigo-600 text-xs flex items-center justify-center font-bold">
                  2
                </span>
                1-on-1 Bilingual AI Mentor ({language})
              </h2>
              <span className="text-xs text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Active-Recall Gate Enabled
              </span>
            </div>

            <div className="flex-1 p-5 overflow-y-auto space-y-4">
              {chat.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 space-y-4">
                  <Sparkles className="w-10 h-10 text-indigo-400" />
                  <div className="max-w-md space-y-1">
                    <p className="text-sm font-medium text-slate-200">
                      Ask anything from your uploaded textbook!
                    </p>
                    <p className="text-xs text-slate-400">
                      Explanations include structured tables, real-world analogies, and an Active-Recall Checkpoint.
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2 pt-2">
                    {[
                      "Yeh chapter ka main concept simple Hinglish mein samjhao",
                      "Ab isko pure Hindi mein samjhao",
                      "Is topic se exam mein kya-kya questions aa sakte hain?",
                    ].map((sample, i) => (
                      <button
                        key={i}
                        onClick={() => handleAsk(sample)}
                        className="text-xs bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 px-3 py-1.5 rounded-full transition cursor-pointer"
                      >
                        &ldquo;{sample}&rdquo;
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                chat.map((msg, idx) => (
                  <div
                    key={idx}
                    className={
                      msg.role === "student"
                        ? "flex justify-end"
                        : "flex justify-start"
                    }
                  >
                    <div
                      className={
                        msg.role === "student"
                          ? "max-w-[85%] rounded-2xl px-4 py-3 text-sm bg-indigo-600 text-white"
                          : "max-w-[85%] rounded-2xl px-4 py-3 text-sm bg-slate-950 border border-slate-800 text-slate-200"
                      }
                    >
                      {msg.role === "student" ? (
                        <div className="whitespace-pre-wrap">{msg.text}</div>
                      ) : (
                        <FormattedMessage text={msg.text} />
                      )}
                      {msg.role === "mentor" &&
                        msg.sourcesCount !== undefined && (
                          <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                            <span>
                              📚 Grounded in {msg.sourcesCount} textbook vector chunks
                            </span>
                            <span className="text-indigo-400">+15 XP Earned</span>
                          </div>
                        )}
                    </div>
                  </div>
                ))
              )}

              {loadingChat && (
                <div className="flex justify-start">
                  <div className="bg-slate-950 border border-slate-800 text-slate-400 rounded-2xl px-4 py-3 text-xs animate-pulse">
                    Searching textbook vectors & crafting {language} explanation...
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950/60 rounded-b-2xl">
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAsk()}
                  placeholder="Ask a question or answer the Active-Recall Checkpoint..."
                  className="flex-1 px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <button
                  onClick={() => handleAsk()}
                  disabled={loadingChat}
                  className="p-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl transition cursor-pointer"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </section>
        )}

        {/* TAB 2: FLASHCARDS & SUMMARY */}
        {activeTab === "flashcards" && (
          <section className="bg-slate-900/80 border border-slate-800 rounded-2xl shadow-lg p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <h2 className="text-base font-bold text-white">
                  Smart Chapter Summary & Active-Recall Flashcards
                </h2>
                <p className="text-xs text-slate-400">
                  Auto-generated from your uploaded textbook vectors in {language}
                </p>
              </div>
              <button
                onClick={() => generateTool("flashcards")}
                disabled={loadingTool}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                <RefreshCw
                  className={loadingTool ? "w-4 h-4 animate-spin" : "w-4 h-4"}
                />
                <span>
                  {flashcardData
                    ? "Regenerate Cards"
                    : "Generate Flashcards (+20 XP)"}
                </span>
              </button>
            </div>

            {loadingTool && (
              <div className="py-16 text-center text-sm text-slate-400 animate-pulse">
                Synthesizing chapter summary & bilingual flashcards from textbook chunks...
              </div>
            )}

            {!loadingTool && !flashcardData && (
              <div className="py-14 text-center space-y-3 text-slate-400">
                <Layers className="w-10 h-10 text-indigo-400 mx-auto" />
                <p className="text-sm text-slate-200 font-medium">
                  Ready to turn your PDF into bite-sized revision cards
                </p>
                <p className="text-xs max-w-md mx-auto">
                  Click &ldquo;Generate Flashcards&rdquo; above to extract key takeaways and interactive flip-cards from your uploaded textbook.
                </p>
              </div>
            )}

            {!loadingTool && flashcardData && (
              <div className="space-y-6">
                {/* Summary Box */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2.5">
                  <h3 className="text-sm font-bold text-indigo-300">
                    📌 {flashcardData.chapter_title} — Quick Revision Summary
                  </h3>
                  <ul className="space-y-1.5 text-xs text-slate-300">
                    {flashcardData.summary_points?.map((pt, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-indigo-400 font-bold">•</span>
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Flip Cards Grid */}
                <div>
                  <p className="text-xs text-slate-400 mb-3">
                    Click any card to flip between the question and explanation:
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {flashcardData.flashcards?.map((card, i) => {
                      const isFlipped = !!flippedCards[i];
                      return (
                        <div
                          key={i}
                          onClick={() => {
                            setFlippedCards((prev) => ({
                              ...prev,
                              [i]: !prev[i],
                            }));
                            if (!isFlipped) setXp((x) => x + 5);
                          }}
                          className={
                            isFlipped
                              ? "p-5 rounded-xl border transition cursor-pointer min-h-[140px] flex flex-col justify-between bg-indigo-950/50 border-indigo-500/50"
                              : "p-5 rounded-xl border transition cursor-pointer min-h-[140px] flex flex-col justify-between bg-slate-950 border-slate-800 hover:border-slate-700"
                          }
                        >
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="px-2 py-0.5 rounded bg-slate-900 text-indigo-300 border border-slate-800">
                              {card.tag || `Card #${i + 1}`}
                            </span>
                            <span className="text-slate-400">
                              {isFlipped
                                ? "Answer (Click to flip)"
                                : "Question (Click to reveal)"}
                            </span>
                          </div>
                          <p className="text-sm font-medium text-slate-100 my-3">
                            {isFlipped ? card.back : card.front}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* TAB 3: ADAPTIVE QUIZ GATE */}
        {activeTab === "quiz" && (
          <section className="bg-slate-900/80 border border-slate-800 rounded-2xl shadow-lg p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <h2 className="text-base font-bold text-white">
                  Adaptive Active-Recall Quiz Arena
                </h2>
                <p className="text-xs text-slate-400">
                  Test your retention on the uploaded curriculum to unlock XP
                </p>
              </div>
              <button
                onClick={() => generateTool("quiz")}
                disabled={loadingTool}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                <RefreshCw
                  className={loadingTool ? "w-4 h-4 animate-spin" : "w-4 h-4"}
                />
                <span>{quizData ? "New Quiz" : "Generate Quiz (+20 XP)"}</span>
              </button>
            </div>

            {loadingTool && (
              <div className="py-16 text-center text-sm text-slate-400 animate-pulse">
                Generating bilingual multiple-choice questions from your textbook...
              </div>
            )}

            {!loadingTool && !quizData && (
              <div className="py-14 text-center space-y-3 text-slate-400">
                <BrainCircuit className="w-10 h-10 text-indigo-400 mx-auto" />
                <p className="text-sm text-slate-200 font-medium">
                  Verify your understanding with an AI-generated checkpoint quiz
                </p>
                <p className="text-xs max-w-md mx-auto">
                  Questions are grounded strictly in your uploaded textbook and explained in {language}.
                </p>
              </div>
            )}

            {!loadingTool && quizData && (
              <div className="space-y-5">
                {quizData.questions?.map((q, qIdx) => (
                  <div
                    key={qIdx}
                    className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3"
                  >
                    <p className="text-sm font-semibold text-white">
                      Q{qIdx + 1}. {q.question}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {q.options.map((opt, oIdx) => {
                        const isSelected = selectedAnswers[qIdx] === oIdx;
                        const isCorrect = q.correct_index === oIdx;

                        let btnStyle =
                          "text-left text-xs p-3 rounded-lg border transition flex items-center justify-between cursor-pointer bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700";
                        if (quizSubmitted) {
                          if (isCorrect) {
                            btnStyle =
                              "text-left text-xs p-3 rounded-lg border transition flex items-center justify-between cursor-pointer bg-emerald-950/60 border-emerald-500/60 text-emerald-200";
                          } else if (isSelected && !isCorrect) {
                            btnStyle =
                              "text-left text-xs p-3 rounded-lg border transition flex items-center justify-between cursor-pointer bg-rose-950/60 border-rose-500/60 text-rose-200";
                          }
                        } else if (isSelected) {
                          btnStyle =
                            "text-left text-xs p-3 rounded-lg border transition flex items-center justify-between cursor-pointer bg-indigo-600/30 border-indigo-500 text-white";
                        }

                        return (
                          <button
                            key={oIdx}
                            disabled={quizSubmitted}
                            onClick={() =>
                              setSelectedAnswers((prev) => ({
                                ...prev,
                                [qIdx]: oIdx,
                              }))
                            }
                            className={btnStyle}
                          >
                            <span>{opt}</span>
                            {quizSubmitted && isCorrect && (
                              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                            )}
                            {quizSubmitted && isSelected && !isCorrect && (
                              <X className="w-4 h-4 text-rose-400 shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {quizSubmitted && (
                      <div className="text-xs text-slate-300 bg-slate-900/90 border border-slate-800 p-3 rounded-lg">
                        <strong className="text-indigo-300">Explanation: </strong>
                        {q.explanation}
                      </div>
                    )}
                  </div>
                ))}

                <div className="flex items-center justify-between pt-2">
                  {!quizSubmitted ? (
                    <button
                      onClick={() => {
                        setQuizSubmitted(true);
                        const score = calculateQuizScore();
                        setXp((prev) => prev + score * 25);
                      }}
                      className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition cursor-pointer"
                    >
                      Submit Answers & Check Score
                    </button>
                  ) : (
                    <div className="flex items-center gap-3 text-sm font-bold text-emerald-400">
                      <span>
                        Score: {calculateQuizScore()} / {quizData.questions.length} Correct! (+
                        {calculateQuizScore() * 25} XP)
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        )}

        {/* TAB 4: CAREER DISCOVERY & STUDY ROADMAP */}
        {activeTab === "career" && (
          <section className="bg-slate-900/80 border border-slate-800 rounded-2xl shadow-lg p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <h2 className="text-base font-bold text-white">
                  Personalized Study Roadmap & Career Discovery Feed
                </h2>
                <p className="text-xs text-slate-400">
                  Connecting your {subject} textbook concepts to real-world opportunities
                </p>
              </div>
              <button
                onClick={() => generateTool("career")}
                disabled={loadingTool}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                <RefreshCw
                  className={loadingTool ? "w-4 h-4 animate-spin" : "w-4 h-4"}
                />
                <span>
                  {careerData ? "Refresh Roadmap" : "Generate Career Map (+20 XP)"}
                </span>
              </button>
            </div>

            {loadingTool && (
              <div className="py-16 text-center text-sm text-slate-400 animate-pulse">
                Mapping your curriculum to real-world careers and building a learning roadmap...
              </div>
            )}

            {!loadingTool && !careerData && (
              <div className="py-14 text-center space-y-3 text-slate-400">
                <Compass className="w-10 h-10 text-indigo-400 mx-auto" />
                <p className="text-sm text-slate-200 font-medium">
                  Discover how this chapter applies to real-world careers
                </p>
                <p className="text-xs max-w-md mx-auto">
                  Generates a 3-step mastery roadmap and bite-sized career cards tailored for students in Tier-2/3 cities.
                </p>
              </div>
            )}

            {!loadingTool && careerData && (
              <div className="space-y-6">
                {/* Step-by-Step Study Roadmap */}
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-indigo-300">
                    🗺️ Personalized Mastery Roadmap
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {careerData.roadmap_steps?.map((item, idx) => (
                      <div
                        key={idx}
                        className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-1.5"
                      >
                        <div className="text-xs font-bold text-indigo-400">
                          {item.step}
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          {item.detail}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Career Cards */}
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-emerald-400">
                    🚀 Real-World Career Connections
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {careerData.careers?.map((c, idx) => (
                      <div
                        key={idx}
                        className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex flex-col justify-between space-y-3"
                      >
                        <div className="space-y-2">
                          <h4 className="text-sm font-bold text-white">
                            {c.role}
                          </h4>
                          <p className="text-xs text-slate-300 leading-relaxed">
                            {c.relevance}
                          </p>
                        </div>
                        <div className="space-y-2 pt-2 border-t border-slate-800">
                          <div className="flex flex-wrap gap-1">
                            {c.skills?.map((s, sIdx) => (
                              <span
                                key={sIdx}
                                className="text-[10px] bg-indigo-950/60 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full"
                              >
                                {s}
                              </span>
                            ))}
                          </div>
                          <p className="text-[11px] text-slate-400">
                            <strong className="text-slate-300">Resources:</strong>{" "}
                            {c.resources}
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

      </div>
    </div>
  );
}