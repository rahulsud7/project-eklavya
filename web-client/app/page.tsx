"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { UserButton, SignInButton, useUser } from "@clerk/nextjs";
import {
  BookOpen, Mic, MicOff, Volume2, Sparkles, UploadCloud, Send, Flame, Trophy,
  Timer, Play, Pause, Languages, CheckCircle2, Layers, BrainCircuit,
  Compass, FileText, Loader2, Edit2, LogIn, MessageSquare, FolderTree, BookMarked, ChevronRight, User, Info, ArrowRight, SquareSquare
} from "lucide-react";
import { useGamification } from "@/context/GamificationContext";

type TabType = "mentor" | "voice" | "upload" | "flashcards" | "quiz" | "roadmap" | "profile" | "about";
type LangMode = "Hinglish" | "Hindi" | "English";

const API_BASE = process.env.NEXT_PUBLIC_FASTAPI_URL || "http://127.0.0.1:8000";
const FALLBACK_SUBJECTS = ["History", "Science", "Mathematics", "Computer Science", "Economics", "Geography"];

// --- INLINE SVG DOODLE PATTERN ---
const DOODLE_PATTERN = `url("data:image/svg+xml,%3Csvg width='120' height='120' viewBox='0 0 120 120' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='%23284E38' stroke-width='1.5' opacity='0.04'%3E%3Cpath d='M10,10 Q20,5 30,10 T50,10' stroke-linecap='round'/%3E%3Ccircle cx='80' cy='20' r='3'/%3E%3Cpath d='M100,80 L110,90 M110,80 L100,90' stroke-linecap='round'/%3E%3Crect x='20' y='80' width='6' height='6' rx='1'/%3E%3Cpath d='M50,100 L55,90 L60,100 Z' stroke-linejoin='round'/%3E%3Cpath d='M10,60 h5 M12.5,57.5 v5' stroke-linecap='round'/%3E%3C/g%3E%3C/svg%3E")`;

interface ChatMessage { role: "student" | "mentor"; text: string; sourcesCount?: number; }
interface DocType { id: string; custom_name: string; subject: string; created_at: string; }

/** Highlighter Markdown Formatter */
function FormattedMessage({ text }: { text: string }) {
  const parts = text.split(/🎯\s*\**Active-Recall Checkpoint:?\**/i);
  const mainBody = parts[0] || "";
  const checkpoint = parts.length > 1 ? parts[1].trim() : null;

  const renderText = (line: string) => {
    return line.split(/(\*\*.*?\*\*)/g).map((seg, i) => 
      seg.startsWith("**") && seg.endsWith("**") ? 
      <strong key={i} className="font-extrabold bg-[#FCECD4] text-[#8C6D23] px-1.5 py-0.5 rounded-md mx-0.5 shadow-sm">{seg.slice(2, -2)}</strong> : 
      <span key={i}>{seg.replace(/`/g, "")}</span>
    );
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2 text-[#3D3A36] leading-relaxed">
        {mainBody.split("\n").map((line, idx) => (
          line.trim() ? (
            <div key={idx} className={line.trim().startsWith("-") || line.trim().startsWith("*") ? "pl-5 relative before:content-['•'] before:absolute before:left-1 before:text-[#284E38] before:font-black" : ""}>
              {renderText(line.replace(/^[-*]\s/, ""))}
            </div>
          ) : <div key={idx} className="h-1" />
        ))}
      </div>
      {checkpoint && (
        <div className="mt-4 p-5 rounded-xl bg-[#EBF2EC] border border-[#C5D9C8] text-[#1E3626] shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-[#284E38]" />
          <div className="text-[11px] font-black uppercase tracking-widest text-[#284E38] mb-2 flex items-center gap-1.5">
            <BrainCircuit className="w-4 h-4"/> Checkpoint
          </div>
          <p className="text-sm font-bold">{renderText(checkpoint)}</p>
        </div>
      )}
    </div>
  );
}

export default function EklavyaDashboard() {
  const { isSignedIn, user, isLoaded } = useUser();
  const { xp, streak, subjects, pomoSeconds, pomoRunning, togglePomo, refreshProfile } = useGamification();
  const studentId = user?.id || "guest";

  // --- STATE ---
  const displaySubjects = subjects && subjects.length > 0 ? subjects : FALLBACK_SUBJECTS;
  const [activeTab, setActiveTab] = useState<TabType>("mentor");
  const [language, setLanguage] = useState<LangMode>("Hinglish");
  const [activeSubject, setActiveSubject] = useState<string>("");
  const [activeDocId, setActiveDocId] = useState<string>("all");

  const [myDocs, setMyDocs] = useState<DocType[]>([]);
  const [fetchingDocs, setFetchingDocs] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ type: "success" | "error" | "info", msg: string } | null>(null);

  const [query, setQuery] = useState("");
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [loadingChat, setLoadingChat] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceQuery, setVoiceQuery] = useState("");
  const [voiceReply, setVoiceReply] = useState("");
  const recognitionRef = useRef<any>(null);

  const [loadingTool, setLoadingTool] = useState(false);
  const [tools, setTools] = useState<any>({});
  const [flippedCards, setFlippedCards] = useState<Record<number, boolean>>({});
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  // Profile Form State
  const [profileForm, setProfileForm] = useState({ course_type: "School", board: "CBSE", class_grade: "Class 10", custom_subjects: "" });
  const [savingProfile, setSavingProfile] = useState(false);

  // --- INITIALIZATION ---
  useEffect(() => { if (!activeSubject && displaySubjects.length > 0) setActiveSubject(displaySubjects[0]); }, [displaySubjects, activeSubject]);
  
  const loadDocuments = useCallback(async () => {
    if (!isSignedIn) return;
    setFetchingDocs(true);
    try {
      const res = await axios.get(`${API_BASE}/api/documents/${user.id}`);
      setMyDocs(res.data.documents || []);
    } catch (e) { console.error(e); } finally { setFetchingDocs(false); }
  }, [isSignedIn, user]);
  
  useEffect(() => { loadDocuments(); }, [loadDocuments]);
  useEffect(() => { setActiveDocId("all"); setTools({}); }, [activeSubject]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chat]);

  // --- VOICE ENGINE (CHUNKED) ---
  useEffect(() => {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRec) {
      const rec = new SpeechRec();
      rec.continuous = false;
      rec.lang = language === "English" ? "en-IN" : "hi-IN";
      rec.onstart = () => setIsListening(true);
      rec.onend = () => setIsListening(false);
      rec.onresult = (e: any) => {
        const spoken = e.results[0][0].transcript;
        setVoiceQuery(spoken);
        handleVoiceQuery(spoken);
      };
      recognitionRef.current = rec;
    }
  }, [language]);

  const speakTextChunked = (text: string) => {
    window.speechSynthesis.cancel();
    const cleanText = text.replace(/[*#_`|🎯]/g, "");
    // Split text by sentence boundaries to prevent browser freezing
    const chunks = cleanText.match(/[^.!?]+[.!?]+/g) || [cleanText]; 
    
    setIsSpeaking(true);
    chunks.forEach((chunk, index) => {
      const utterance = new SpeechSynthesisUtterance(chunk.trim());
      utterance.lang = language === "English" ? "en-IN" : "hi-IN";
      if (index === chunks.length - 1) utterance.onend = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    });
  };

  const stopAudio = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  // --- HELPERS & HANDLERS ---
  const docsForSubject = myDocs.filter(d => d.subject === activeSubject);
  const groupedDocs = myDocs.reduce((acc, doc) => { (acc[doc.subject] = acc[doc.subject] || []).push(doc); return acc; }, {} as Record<string, DocType[]>);
  const formatTimer = (secs: number) => `${Math.floor(secs / 60).toString().padStart(2, "0")}:${(secs % 60).toString().padStart(2, "0")}`;

  const handleUpload = async () => {
    if (!file) return setUploadStatus({ type: "error", msg: "Select a PDF." });
    setUploading(true); setUploadStatus({ type: "info", msg: "Chunking & Vectorizing..." });
    const formData = new FormData();
    formData.append("user_id", studentId); formData.append("subject", activeSubject); formData.append("file", file);
    try {
      await axios.post(`${API_BASE}/api/upload`, formData);
      setUploadStatus({ type: "success", msg: "Knowledge Base Updated!" });
      setFile(null); loadDocuments();
      setTimeout(() => setUploadStatus(null), 4000);
    } catch (err) { setUploadStatus({ type: "error", msg: "Upload failed." }); } finally { setUploading(false); }
  };

  const handleAsk = async (preset?: string) => {
    const promptText = preset ?? query;
    if (!promptText.trim() || loadingChat) return;
    setChat(prev => [...prev, { role: "student", text: promptText }]);
    setQuery(""); setLoadingChat(true);
    try {
      const res = await axios.post(`${API_BASE}/api/query`, { user_id: studentId, subject: activeSubject, doc_id: activeDocId === "all" ? null : activeDocId, language, query: promptText, history: chat.slice(-4) });
      setChat(prev => [...prev, { role: "mentor", text: res.data.answer, sourcesCount: res.data.sources?.length }]);
    } catch { setChat(prev => [...prev, { role: "mentor", text: "⚠️ Network Error." }]); } finally { setLoadingChat(false); }
  };

  const handleVoiceQuery = async (queryText: string) => {
    try {
      const res = await axios.post(`${API_BASE}/api/query`, { user_id: studentId, subject: activeSubject, doc_id: activeDocId === "all" ? null : activeDocId, language, query: queryText });
      setVoiceReply(res.data.answer);
      speakTextChunked(res.data.answer);
    } catch (e) { setVoiceReply("Error connecting to server."); }
  };

  const generateTool = async (type: "flashcards" | "quiz" | "career") => {
    setLoadingTool(true);
    try {
      const res = await axios.post(`${API_BASE}/api/study-tools`, { user_id: studentId, subject: activeSubject, doc_id: activeDocId === "all" ? null : activeDocId, tool_type: type, language });
      setTools((prev: any) => ({ ...prev, [type]: res.data.data }));
      if (type === "quiz") { setQuizAnswers({}); setQuizSubmitted(false); }
      if (type === "flashcards") { setFlippedCards({}); }
    } catch (e) { console.error(e); } finally { setLoadingTool(false); }
  };

  const saveProfile = async () => {
    setSavingProfile(true);
    const subArray = profileForm.custom_subjects.split(",").map(s => s.trim()).filter(Boolean);
    try {
      await axios.post(`${API_BASE}/api/user/onboard`, { user_id: studentId, class_grade: profileForm.class_grade, course_type: profileForm.course_type, board: profileForm.board, subjects: subArray.length ? subArray : displaySubjects });
      await refreshProfile();
      alert("Profile updated! Your new subjects are now available.");
    } catch (e) { alert("Failed to save profile."); } finally { setSavingProfile(false); }
  };

  const handleRename = async (docId: string, currentName: string) => {
    const newName = prompt("Rename document:", currentName);
    if (!newName || newName === currentName) return;
    try {
      await axios.patch(`${API_BASE}/api/documents/${docId}`, { custom_name: newName });
      loadDocuments();
    } catch (e) { alert("Failed to rename."); }
  };

  // --- RENDER STATES ---
  if (!isLoaded) return <div className="min-h-screen bg-[#F6F4EE] flex justify-center items-center" style={{ backgroundImage: DOODLE_PATTERN }}><Loader2 className="w-10 h-10 animate-spin text-[#284E38]"/></div>;

  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-[#F6F4EE] flex items-center justify-center p-6 relative" style={{ backgroundImage: DOODLE_PATTERN }}>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#F6F4EE]/50 z-0" />
        <div className="max-w-lg w-full bg-white/90 backdrop-blur-sm rounded-[2rem] p-10 shadow-2xl border border-[#E3DDCF] text-center space-y-6 z-10 animate-in fade-in zoom-in-95">
          <div className="w-24 h-24 bg-[#EBF2EC] rounded-3xl flex items-center justify-center mx-auto shadow-inner border border-[#C5D9C8] rotate-3"><BookOpen className="w-12 h-12 text-[#284E38] -rotate-3"/></div>
          <h1 className="text-4xl font-black text-[#1E3626] tracking-tight">Eklavya</h1>
          <p className="text-[#696359] text-lg font-medium">The Bilingual AI Mentor for Indian Students.</p>
          <div className="pt-4">
            <SignInButton mode="modal"><button className="w-full py-4 bg-[#284E38] hover:bg-[#1E3626] text-white font-bold rounded-2xl shadow-xl hover:shadow-2xl hover:-translate-y-0.5 flex items-center justify-center gap-2 transition-all cursor-pointer"><LogIn className="w-5 h-5"/> Sign In / Sign Up</button></SignInButton>
          </div>
        </div>
      </div>
    );
  }

  // --- MAIN PLATFORM RENDER ---
  return (
    <div className="min-h-screen bg-[#F6F4EE] flex flex-col font-sans relative" style={{ backgroundImage: DOODLE_PATTERN }}>
      
      {/* 1. TOP HEADER */}
      <header className="h-16 bg-white/95 backdrop-blur-md border-b border-[#E3DDCF] sticky top-0 z-50 px-4 md:px-8 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3 cursor-default">
          <div className="bg-[#284E38] p-2 rounded-xl text-white shadow-md"><BookOpen className="w-5 h-5"/></div>
          <h1 className="font-extrabold text-[#1C3626] text-lg tracking-tight hidden sm:block">Project Eklavya</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:flex bg-[#FAF8F5] border border-[#E3DDCF] rounded-xl overflow-hidden text-xs font-bold text-[#544F46] shadow-sm">
            <div className="px-4 py-2.5 flex items-center gap-2 border-r border-[#E3DDCF] text-[#B85C38]">
              <Timer className="w-4 h-4"/> <span className="w-10 text-center font-mono text-sm">{formatTimer(pomoSeconds)}</span>
              <button onClick={togglePomo} className="ml-1 hover:text-[#284E38] transition cursor-pointer bg-[#FDF0EC] p-1 rounded-md">{pomoRunning ? <Pause className="w-3.5 h-3.5"/> : <Play className="w-3.5 h-3.5"/>}</button>
            </div>
            <div className="px-4 py-2.5 flex items-center gap-1.5 border-r border-[#E3DDCF] text-[#8C6D23]"><Flame className="w-4 h-4"/> {streak}d</div>
            <div className="px-4 py-2.5 flex items-center gap-1.5 text-[#284E38] bg-[#EBF2EC]"><Trophy className="w-4 h-4"/> {xp} XP</div>
          </div>
          <UserButton afterSignOutUrl="/" appearance={{ elements: { avatarBox: "w-10 h-10 shadow-md border-2 border-white" }}}/>
        </div>
      </header>

      {/* 2. CONTEXT CONTROL BAR */}
      <div className="bg-white/95 backdrop-blur-md border-b border-[#E3DDCF] px-4 md:px-8 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm z-40 relative">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-extrabold text-[#1E3626] flex items-center gap-1.5 uppercase tracking-wide text-xs"><BookMarked className="w-4 h-4 text-[#8C6D23]"/> Library:</span>
          <select value={activeSubject} onChange={(e) => setActiveSubject(e.target.value)} className="bg-[#FAF8F5] border border-[#D9D3C7] text-xs font-bold px-3 py-1.5 rounded-lg text-[#284E38] focus:outline-none cursor-pointer hover:border-[#284E38] transition shadow-sm">
            {displaySubjects.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <ChevronRight className="w-4 h-4 text-[#C5D9C8]"/>
          <select value={activeDocId} onChange={(e) => setActiveDocId(e.target.value)} className="bg-[#FAF8F5] border border-[#D9D3C7] text-xs font-bold px-3 py-1.5 rounded-lg text-[#544F46] focus:outline-none cursor-pointer hover:border-[#284E38] transition shadow-sm max-w-[200px] truncate">
            <option value="all">📚 Entire Subject</option>
            {docsForSubject.map(d => <option key={d.id} value={d.id}>📄 {d.custom_name}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Languages className="w-4 h-4 text-[#696359]"/>
          <select value={language} onChange={e => setLanguage(e.target.value as LangMode)} className="bg-transparent text-xs font-black text-[#1E3626] focus:outline-none cursor-pointer uppercase tracking-wider">
            <option>Hinglish</option><option>Hindi</option><option>English</option>
          </select>
        </div>
      </div>

      {/* 3. MAIN WORKSPACE */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 flex flex-col md:flex-row gap-6 relative z-10">
        
        {/* SIDEBAR NAVIGATION */}
        <nav className="w-full md:w-56 shrink-0 flex md:flex-col gap-2 overflow-x-auto md:overflow-visible pb-2 md:pb-0">
          {[
            { id: "mentor", label: "AI Mentor", icon: MessageSquare },
            { id: "upload", label: "Curriculum Vault", icon: UploadCloud },
            { id: "flashcards", label: "Flashcards", icon: Layers },
            { id: "quiz", label: "Quiz Arena", icon: BrainCircuit },
            { id: "roadmap", label: "Career Map", icon: Compass },
            { id: "voice", label: "Talk Live", icon: Mic },
            { id: "profile", label: "My Profile", icon: User },
            { id: "about", label: "About System", icon: Info },
          ].map(tab => (
            <button
              key={tab.id} onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === tab.id ? "bg-[#284E38] text-white shadow-lg shadow-[#284E38]/20 scale-[1.02]" : "text-[#544F46] bg-white border border-[#E3DDCF] hover:bg-[#EAE6DB] hover:text-[#1E3626] shadow-sm"
              }`}
            >
              <tab.icon className="w-4 h-4" /> {tab.label}
            </button>
          ))}
        </nav>

        {/* CONTENT PANELS (Glassmorphic) */}
        <div className="flex-1 bg-white/95 backdrop-blur-xl border border-[#E3DDCF] rounded-3xl shadow-xl overflow-hidden flex flex-col min-h-[600px] max-h-[calc(100vh-12rem)] relative">
          
          {/* --- TAB: MENTOR --- */}
          {activeTab === "mentor" && (
            <>
              <div className="flex-1 p-4 md:p-8 overflow-y-auto space-y-6 bg-[#FCFBF8]">
                 {chat.length === 0 && (
                   <div className="flex flex-col items-center justify-center h-full text-[#696359] space-y-4 animate-in fade-in slide-in-from-bottom-4">
                     <div className="w-20 h-20 bg-[#EBF2EC] rounded-3xl flex items-center justify-center shadow-inner border border-[#C5D9C8] rotate-3"><Sparkles className="w-10 h-10 text-[#284E38] -rotate-3"/></div>
                     <h3 className="font-extrabold text-2xl text-[#1E3626]">Ask Eklavya Anything</h3>
                     <p className="text-sm font-medium">Scanning vectors from: <strong className="text-[#284E38] bg-[#EBF2EC] px-2 py-0.5 rounded border border-[#C5D9C8]">{activeDocId === "all" ? `All ${activeSubject} Docs` : myDocs.find(d=>d.id===activeDocId)?.custom_name}</strong></p>
                   </div>
                 )}
                 {chat.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === "student" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[95%] md:max-w-[85%] rounded-3xl px-6 py-5 text-sm shadow-md ${msg.role === "student" ? "bg-[#284E38] text-white rounded-br-sm" : "bg-white border border-[#E3DDCF] text-[#2E2B27] rounded-bl-sm"}`}>
                        {msg.role === "student" ? <div className="whitespace-pre-wrap font-medium">{msg.text}</div> : <FormattedMessage text={msg.text}/>}
                      </div>
                    </div>
                  ))}
                  {loadingChat && <div className="text-sm font-bold text-[#696359] flex items-center gap-2 pl-2"><Loader2 className="w-4 h-4 animate-spin text-[#284E38]"/> Synthesizing intelligence...</div>}
                  <div ref={chatEndRef} />
              </div>
              <div className="p-4 md:p-6 border-t border-[#E3DDCF] flex gap-3 bg-white shrink-0">
                 <input type="text" value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleAsk()} placeholder="Ask a question..." className="flex-1 bg-[#FAF8F5] border border-[#D9D3C7] rounded-2xl px-6 py-4 focus:outline-none focus:border-[#284E38] focus:ring-1 focus:ring-[#284E38] font-medium shadow-sm" />
                 <button onClick={() => handleAsk()} disabled={!query.trim() || loadingChat} className="px-6 bg-[#284E38] hover:bg-[#203F2D] text-white rounded-2xl cursor-pointer disabled:opacity-50 transition-all shadow-md hover:shadow-lg"><Send className="w-5 h-5"/></button>
              </div>
            </>
          )}

          {/* --- TAB: VAULT --- */}
          {activeTab === "upload" && (
             <div className="p-6 md:p-10 overflow-y-auto h-full bg-[#FCFBF8]">
               <h2 className="text-3xl font-black text-[#1E3626] mb-8">Curriculum Vault</h2>
               <div className="flex flex-col gap-4 mb-10 bg-white p-8 rounded-3xl border border-[#D9D3C7] shadow-md">
                 <div className="flex items-center justify-between border-b border-[#F0EBE0] pb-5 mb-3">
                   <div>
                     <h3 className="font-extrabold text-lg text-[#1E3626]">Upload New Document</h3>
                     <p className="text-xs font-medium text-[#696359] mt-1">Ingest a standard PDF to enable semantic search.</p>
                   </div>
                   <div className="bg-[#EBF2EC] px-4 py-2 rounded-xl border border-[#C5D9C8] flex items-center gap-2 text-xs font-bold text-[#284E38]">
                     Destination: <select value={activeSubject} onChange={(e) => setActiveSubject(e.target.value)} className="bg-transparent focus:outline-none cursor-pointer">{displaySubjects.map(s => <option key={s} value={s}>{s}</option>)}</select>
                   </div>
                 </div>
                 <div className="flex flex-col sm:flex-row gap-4 items-center">
                   <input type="file" accept=".pdf" onChange={e => setFile(e.target.files?.[0] || null)} className="w-full sm:flex-1 text-sm file:mr-4 file:py-3 file:px-5 file:rounded-xl file:border-0 file:bg-[#F6F4EE] file:text-[#284E38] file:font-bold hover:file:bg-[#EAE6DB] cursor-pointer border border-[#D9D3C7] rounded-2xl p-1.5 transition-all" />
                   <button onClick={handleUpload} disabled={uploading || !file} className="w-full sm:w-auto px-8 py-4 bg-[#284E38] hover:bg-[#203F2D] text-white rounded-2xl font-bold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 shadow-md transition-all"><UploadCloud className="w-5 h-5"/> {uploading ? "Ingesting..." : "Upload Vector"}</button>
                 </div>
                 {uploadStatus && (
                   <div className={`p-4 rounded-xl text-sm font-bold border ${uploadStatus.type === 'error' ? 'bg-red-50 text-red-700 border-red-200' : uploadStatus.type === 'info' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-[#EBF2EC] text-[#284E38] border-[#C5D9C8]'} flex items-center gap-2 animate-in fade-in`}>
                     {uploadStatus.type === 'info' && <Loader2 className="w-4 h-4 animate-spin"/>} {uploadStatus.msg}
                   </div>
                 )}
               </div>

               {fetchingDocs ? (
                 <div className="py-12 flex justify-center"><Loader2 className="w-10 h-10 animate-spin text-[#C5D9C8]" /></div>
               ) : Object.keys(groupedDocs).length === 0 ? (
                 <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-[#D9D3C7]">
                   <FileText className="w-16 h-16 text-[#E3DDCF] mx-auto mb-4" />
                   <p className="text-[#696359] font-bold text-lg">Your vault is empty.</p>
                   <p className="text-sm font-medium text-[#8C6D23] mt-1">Start by uploading a PDF above.</p>
                 </div>
               ) : (
                 Object.entries(groupedDocs).map(([subj, docs]) => (
                   <div key={subj} className="mb-8 bg-white p-6 rounded-3xl border border-[#E3DDCF] shadow-sm">
                     <h3 className="text-xs font-black text-[#1E3626] flex items-center gap-2 mb-5 border-b border-[#F0EBE0] pb-3 uppercase tracking-widest">
                       <FolderTree className="w-4 h-4 text-[#8C6D23]"/> {subj} Collection
                     </h3>
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                       {docs.map(doc => (
                         <div key={doc.id} className="group flex items-center justify-between p-4 rounded-2xl border border-[#E3DDCF] bg-[#FAF8F5] hover:border-[#284E38] hover:shadow-md transition-all cursor-default">
                           <div className="flex items-center gap-3 overflow-hidden">
                             <div className="bg-white p-2.5 rounded-xl border border-[#D9D3C7] shadow-sm"><FileText className="w-4 h-4 text-[#284E38]"/></div>
                             <div className="flex flex-col min-w-0">
                               <span className="font-extrabold text-sm text-[#1E3626] truncate">{doc.custom_name}</span>
                               <span className="text-[10px] text-[#696359] font-bold uppercase tracking-wider">{new Date(doc.created_at).toLocaleDateString()}</span>
                             </div>
                           </div>
                           <button onClick={() => handleRename(doc.id, doc.custom_name)} className="opacity-0 group-hover:opacity-100 p-2 hover:bg-[#EBF2EC] rounded-xl cursor-pointer transition-all border border-transparent hover:border-[#C5D9C8]"><Edit2 className="w-4 h-4 text-[#284E38]"/></button>
                         </div>
                       ))}
                     </div>
                   </div>
                 ))
               )}
             </div>
          )}

          {/* --- TAB: QUIZ --- */}
          {activeTab === "quiz" && (
             <div className="p-6 md:p-10 flex flex-col h-full bg-[#FCFBF8]">
                <div className="flex flex-col sm:flex-row justify-between sm:items-end mb-8 border-b border-[#E3DDCF] pb-5 gap-4">
                  <div>
                    <h2 className="text-3xl font-black text-[#1E3626]">Quiz Arena</h2>
                    <p className="text-[#696359] mt-1 text-sm font-medium">Testing: {activeDocId === "all" ? activeSubject : myDocs.find(d=>d.id===activeDocId)?.custom_name}</p>
                  </div>
                  <button onClick={() => generateTool("quiz")} disabled={loadingTool} className="px-6 py-3.5 bg-[#284E38] hover:bg-[#203F2D] text-white text-sm font-bold rounded-2xl flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all disabled:opacity-50 cursor-pointer">
                    {loadingTool ? <Loader2 className="w-4 h-4 animate-spin"/> : <BrainCircuit className="w-4 h-4"/>} Generate Quiz
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto pr-2">
                  {!tools.quiz && !loadingTool && (
                    <div className="h-full flex flex-col items-center justify-center text-[#696359] space-y-4"><div className="w-24 h-24 bg-white border border-[#E3DDCF] rounded-full flex items-center justify-center shadow-sm"><BrainCircuit className="w-12 h-12 text-[#284E38]"/></div><p className="font-bold text-lg">No quiz active. Click generate to begin.</p></div>
                  )}
                  {tools.quiz && (
                    <div className="space-y-8 pb-8 animate-in fade-in slide-in-from-bottom-4">
                      {tools.quiz.questions.map((q: any, idx: number) => {
                        return (
                          <div key={idx} className="bg-white border border-[#E3DDCF] p-8 rounded-3xl shadow-sm">
                            <h4 className="font-extrabold text-[#1E3626] mb-6 text-xl leading-relaxed">Q{idx+1}. {q.question}</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {q.options.map((opt: string, oIdx: number) => {
                                let style = "border-[#D9D3C7] bg-[#FAF8F5] hover:border-[#284E38]";
                                if (quizSubmitted) {
                                  if (q.correct_index === oIdx) style = "border-[#3D7051] bg-[#EBF2EC] font-black text-[#1E3626] ring-2 ring-[#3D7051]";
                                  else if (quizAnswers[idx] === oIdx) style = "border-[#E8AEA0] bg-[#FDF0EC] text-[#8C3A27]";
                                } else if (quizAnswers[idx] === oIdx) {
                                  style = "border-[#284E38] bg-[#284E38] text-white shadow-md";
                                }
                                return (
                                  <button key={oIdx} disabled={quizSubmitted} onClick={() => setQuizAnswers(p => ({...p, [idx]: oIdx}))} className={`p-5 text-sm text-left border rounded-2xl transition-all cursor-pointer font-bold ${style}`}>
                                    {opt}
                                  </button>
                                );
                              })}
                            </div>
                            {quizSubmitted && <div className="mt-6 p-5 bg-[#FAF8F5] rounded-2xl text-sm border border-[#E3DDCF] leading-relaxed"><strong className="text-[#284E38] uppercase tracking-widest text-[11px] block mb-2 font-black">Explanation</strong> <span className="font-medium text-[#3D3A36]">{q.explanation}</span></div>}
                          </div>
                        );
                      })}
                      <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-[#E3DDCF] shadow-lg sticky bottom-0 z-10">
                         {!quizSubmitted ? (
                           <button onClick={() => setQuizSubmitted(true)} disabled={Object.keys(quizAnswers).length < tools.quiz!.questions.length} className="px-8 py-4 bg-[#1E3626] hover:bg-black text-white rounded-2xl font-bold flex items-center gap-2 cursor-pointer disabled:opacity-50 transition-all shadow-md"><CheckCircle2 className="w-5 h-5"/> Submit & Grade</button>
                         ) : (
                           <div className="text-xl font-black text-[#284E38] bg-[#EBF2EC] px-8 py-4 rounded-2xl border border-[#C5D9C8]">Final Score: {Object.values(quizAnswers).filter((ans, i) => ans === tools.quiz!.questions[i].correct_index).length} / {tools.quiz!.questions.length}</div>
                         )}
                      </div>
                    </div>
                  )}
                </div>
             </div>
          )}

          {/* --- TAB: FLASHCARDS --- */}
          {activeTab === "flashcards" && (
             <div className="p-6 md:p-10 flex flex-col h-full bg-[#FCFBF8]">
                <div className="flex flex-col sm:flex-row justify-between sm:items-end mb-8 border-b border-[#E3DDCF] pb-5 gap-4">
                  <div>
                    <h2 className="text-3xl font-black text-[#1E3626]">Flashcards</h2>
                    <p className="text-[#696359] mt-1 text-sm font-medium">Summaries for: {activeDocId === "all" ? activeSubject : myDocs.find(d=>d.id===activeDocId)?.custom_name}</p>
                  </div>
                  <button onClick={() => generateTool("flashcards")} disabled={loadingTool} className="px-6 py-3.5 bg-[#284E38] hover:bg-[#203F2D] text-white text-sm font-bold rounded-2xl flex items-center justify-center gap-2 shadow-lg transition-all disabled:opacity-50 cursor-pointer">
                    {loadingTool ? <Loader2 className="w-4 h-4 animate-spin"/> : <Layers className="w-4 h-4"/>} Generate Cards
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto">
                  {!tools.flashcards && !loadingTool && (
                    <div className="h-full flex flex-col items-center justify-center text-[#696359] space-y-4"><div className="w-24 h-24 bg-white border border-[#E3DDCF] rounded-full flex items-center justify-center shadow-sm"><Layers className="w-12 h-12 text-[#284E38]"/></div><p className="font-bold text-lg">No flashcards active.</p></div>
                  )}
                  {tools.flashcards && (
                    <div className="space-y-8 pb-8 animate-in fade-in slide-in-from-bottom-4">
                      <div className="bg-white p-8 rounded-3xl border border-[#E3DDCF] shadow-sm">
                        <h3 className="font-black text-[#1E3626] mb-5 text-2xl border-b border-[#F0EBE0] pb-4">{tools.flashcards.chapter_title}</h3>
                        <ul className="space-y-4">
                          {tools.flashcards.summary_points.map((pt: string, i: number) => (
                            <li key={i} className="text-sm font-bold text-[#3D3A36] flex items-start gap-3"><div className="w-2.5 h-2.5 rounded-full bg-[#8C6D23] mt-1 shrink-0" />{pt}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {tools.flashcards.flashcards.map((card: any, idx: number) => {
                          const isFlipped = !!flippedCards[idx];
                          return (
                            <div key={idx} onClick={() => setFlippedCards(p => ({...p, [idx]: !p[idx]}))} className={`relative p-8 rounded-3xl border cursor-pointer transition-all duration-300 min-h-[220px] flex flex-col justify-center shadow-md ${isFlipped ? 'bg-[#EBF2EC] border-[#C5D9C8] rotate-y-180' : 'bg-white border-[#D9D3C7] hover:border-[#284E38] hover:-translate-y-2'}`}>
                               <span className="absolute top-5 right-5 text-[10px] uppercase font-black tracking-widest text-[#B85C38] bg-[#FDF0EC] px-3 py-1.5 rounded-lg border border-[#E8AEA0]">{card.tag}</span>
                               <span className="absolute top-5 left-5 text-[10px] uppercase font-black tracking-widest text-[#696359]">{isFlipped ? "Answer" : "Question"}</span>
                               <p className={`text-center font-bold leading-relaxed ${isFlipped ? 'text-[#1E3626] text-sm mt-8' : 'text-[#2E2B27] text-lg mt-8'}`}>
                                 {isFlipped ? card.back : card.front}
                               </p>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
             </div>
          )}

          {/* --- TAB: ROADMAP --- */}
          {activeTab === "roadmap" && (
             <div className="p-6 md:p-10 flex flex-col h-full bg-[#FCFBF8]">
                <div className="flex flex-col sm:flex-row justify-between sm:items-end mb-8 border-b border-[#E3DDCF] pb-5 gap-4">
                  <div>
                    <h2 className="text-3xl font-black text-[#1E3626]">Career Map</h2>
                    <p className="text-[#696359] mt-1 text-sm font-medium">Bridging {activeSubject} to the real world.</p>
                  </div>
                  <button onClick={() => generateTool("career")} disabled={loadingTool} className="px-6 py-3.5 bg-[#284E38] hover:bg-[#203F2D] text-white text-sm font-bold rounded-2xl flex items-center justify-center gap-2 shadow-lg transition-all disabled:opacity-50 cursor-pointer">
                    {loadingTool ? <Loader2 className="w-4 h-4 animate-spin"/> : <Compass className="w-4 h-4"/>} Generate Map
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto">
                  {!tools.career && !loadingTool && (
                    <div className="h-full flex flex-col items-center justify-center text-[#696359] space-y-4"><div className="w-24 h-24 bg-white border border-[#E3DDCF] rounded-full flex items-center justify-center shadow-sm"><Compass className="w-12 h-12 text-[#284E38]"/></div><p className="font-bold text-lg">No career map active.</p></div>
                  )}
                  {tools.career && (
                    <div className="space-y-12 pb-8 animate-in fade-in slide-in-from-bottom-4">
                      <div>
                        <h3 className="font-black text-[#1E3626] uppercase tracking-widest text-xs mb-6 flex items-center gap-2"><Trophy className="w-5 h-5 text-[#8C6D23]"/> Learning Milestones</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          {tools.career.roadmap_steps.map((step: any, i: number) => (
                            <div key={i} className="bg-white p-8 rounded-3xl border border-[#E3DDCF] shadow-sm relative overflow-hidden">
                              <div className="absolute top-0 left-0 w-full h-2 bg-[#284E38]" />
                              <span className="text-[11px] font-black uppercase tracking-widest text-[#B85C38] mb-3 block bg-[#FDF0EC] w-max px-3 py-1 rounded-md border border-[#E8AEA0]">Phase {i+1}</span>
                              <h4 className="font-extrabold text-[#1E3626] text-xl mb-3">{step.step}</h4>
                              <p className="text-sm text-[#544F46] leading-relaxed font-medium">{step.detail}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h3 className="font-black text-[#1E3626] uppercase tracking-widest text-xs mb-6 flex items-center gap-2"><Compass className="w-5 h-5 text-[#284E38]"/> Career Pathways</h3>
                        <div className="space-y-5">
                          {tools.career.careers.map((career: any, i: number) => (
                            <div key={i} className="bg-white p-8 rounded-3xl border border-[#E3DDCF] shadow-sm flex flex-col md:flex-row gap-8 md:items-center hover:border-[#C5D9C8] transition-all">
                              <div className="flex-1">
                                <h4 className="font-black text-[#1E3626] text-2xl mb-2">{career.role}</h4>
                                <p className="text-sm text-[#544F46] font-medium leading-relaxed">{career.relevance}</p>
                              </div>
                              <div className="w-full md:w-1/3 shrink-0 bg-[#FAF8F5] p-5 rounded-2xl border border-[#F0EBE0]">
                                <div className="flex flex-wrap gap-2 mb-4">
                                  {career.skills.map((s: string, si: number) => <span key={si} className="text-[10px] font-black uppercase tracking-wider bg-[#EBF2EC] text-[#284E38] px-3 py-1.5 rounded-lg border border-[#C5D9C8]">{s}</span>)}
                                </div>
                                <p className="text-xs text-[#8C6D23] font-bold leading-relaxed"><strong className="text-[#696359] uppercase tracking-widest block mb-1">Resource Path:</strong> {career.resources}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
             </div>
          )}

          {/* --- TAB: VOICE --- */}
          {activeTab === "voice" && (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-[#FCFBF8] relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-t from-white to-transparent opacity-50 z-0" />
              <div className="z-10 flex flex-col items-center max-w-2xl w-full">
                <h2 className="text-4xl font-black text-[#1E3626]">Talk to Eklavya</h2>
                <p className="text-[#696359] mt-3 font-medium text-lg">Your mentor will reply vocally in {language}.</p>
                
                <div className="relative mt-16 mb-12">
                  {(isListening || isSpeaking) && <div className="absolute inset-0 bg-[#284E38]/20 rounded-full scale-[2] animate-ping" />}
                  <button onClick={() => { if(isListening) { recognitionRef.current?.stop(); } else { stopAudio(); recognitionRef.current?.start(); } }} className={`relative w-40 h-40 rounded-full flex items-center justify-center shadow-2xl cursor-pointer transition-all ${isListening ? "bg-[#B85C38] scale-110" : isSpeaking ? "bg-[#284E38] scale-110" : "bg-white border-8 border-[#E3DDCF] hover:border-[#284E38]"}`}>
                    {isListening ? <MicOff className="w-14 h-14 text-white animate-pulse"/> : isSpeaking ? <Volume2 className="w-14 h-14 text-white animate-bounce"/> : <Mic className="w-14 h-14 text-[#284E38]"/>}
                  </button>
                </div>

                {isSpeaking && (
                  <button onClick={stopAudio} className="px-8 py-3 bg-red-100 text-red-700 font-black uppercase tracking-widest text-xs rounded-full border border-red-200 shadow-sm mb-6 cursor-pointer hover:bg-red-200 transition-all">
                    Stop Audio
                  </button>
                )}

                {(voiceQuery || voiceReply) && (
                  <div className="mt-4 w-full space-y-5 text-left animate-in fade-in slide-in-from-bottom-4">
                    {voiceQuery && <div className="bg-white border border-[#E3DDCF] p-6 rounded-3xl shadow-sm"><span className="text-[11px] font-black text-[#284E38] uppercase tracking-widest block mb-3">You Said:</span><p className="text-base font-bold text-[#2E2B27]">{voiceQuery}</p></div>}
                    {voiceReply && <div className="bg-[#EBF2EC] border border-[#C5D9C8] p-6 rounded-3xl shadow-sm"><span className="text-[11px] font-black text-[#284E38] uppercase tracking-widest block mb-3">Mentor:</span><p className="text-base font-bold text-[#1E3626] leading-relaxed">{voiceReply}</p></div>}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* --- TAB: PROFILE --- */}
          {activeTab === "profile" && (
            <div className="p-6 md:p-10 overflow-y-auto h-full bg-[#FCFBF8]">
              <div className="max-w-3xl mx-auto space-y-10">
                <div>
                  <h2 className="text-3xl font-black text-[#1E3626]">Student Profile</h2>
                  <p className="text-[#696359] mt-2 font-medium">Configure your academic environment. This populates your Library dropdown.</p>
                </div>
                
                <div className="bg-white p-10 rounded-3xl border border-[#E3DDCF] shadow-xl space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <label className="text-xs font-black uppercase tracking-widest text-[#1E3626]">Course Type</label>
                      <select value={profileForm.course_type} onChange={e=>setProfileForm({...profileForm, course_type: e.target.value})} className="w-full bg-[#F6F4EE] border border-[#D9D3C7] rounded-2xl p-4 text-sm font-bold focus:border-[#284E38] outline-none cursor-pointer">
                        <option>School</option><option>College / University</option>
                      </select>
                    </div>
                    <div className="space-y-3">
                      <label className="text-xs font-black uppercase tracking-widest text-[#1E3626]">Board / Authority</label>
                      <select value={profileForm.board} onChange={e=>setProfileForm({...profileForm, board: e.target.value})} className="w-full bg-[#F6F4EE] border border-[#D9D3C7] rounded-2xl p-4 text-sm font-bold focus:border-[#284E38] outline-none cursor-pointer">
                        <option>CBSE</option><option>ICSE</option><option>State Board</option><option>University Grants Commission (UGC)</option><option>AICTE</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <label className="text-xs font-black uppercase tracking-widest text-[#1E3626]">Class / Grade / Year</label>
                    <input type="text" value={profileForm.class_grade} onChange={e=>setProfileForm({...profileForm, class_grade: e.target.value})} placeholder="e.g. Class 10, BCA 1st Year" className="w-full bg-[#F6F4EE] border border-[#D9D3C7] rounded-2xl p-4 text-sm font-bold focus:border-[#284E38] outline-none"/>
                  </div>

                  <div className="space-y-3">
                    <label className="text-xs font-black uppercase tracking-widest text-[#1E3626]">Your Subjects (Comma separated)</label>
                    <input type="text" value={profileForm.custom_subjects} onChange={e=>setProfileForm({...profileForm, custom_subjects: e.target.value})} placeholder="Physics, Mathematics, Computer Science..." className="w-full bg-[#F6F4EE] border border-[#D9D3C7] rounded-2xl p-4 text-sm font-bold focus:border-[#284E38] outline-none"/>
                    <p className="text-xs text-[#8C6D23] font-bold">These subjects will automatically appear in your Library & Vault dropdowns.</p>
                  </div>

                  <button onClick={saveProfile} disabled={savingProfile} className="w-full py-5 bg-[#284E38] hover:bg-[#203F2D] text-white rounded-2xl font-black tracking-wider uppercase text-sm cursor-pointer transition-all shadow-lg hover:shadow-xl disabled:opacity-50 mt-4">
                    {savingProfile ? "Saving Profile..." : "Update Library Profile"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* --- TAB: ABOUT US --- */}
          {activeTab === "about" && (
             <div className="p-6 md:p-10 overflow-y-auto h-full bg-[#FCFBF8]">
                <div className="max-w-4xl mx-auto space-y-14 pb-10">
                  <div className="text-center space-y-5">
                    <div className="w-20 h-20 bg-white rounded-3xl mx-auto flex items-center justify-center border border-[#E3DDCF] shadow-sm rotate-3"><Info className="w-10 h-10 text-[#8C6D23] -rotate-3"/></div>
                    <h2 className="text-4xl font-black text-[#1E3626]">Why Eklavya Exists</h2>
                    <p className="text-lg text-[#696359] max-w-2xl mx-auto leading-relaxed font-medium">Breaking the language barrier in Tier-2/3 India by combining cognitive psychology with multilingual RAG architecture.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-white p-8 rounded-3xl border border-[#E3DDCF] shadow-lg">
                      <h3 className="font-black text-[#1E3626] text-xl mb-4 flex items-center gap-3"><BrainCircuit className="w-6 h-6 text-[#8C6D23]"/> Human Psychology</h3>
                      <ul className="space-y-5 text-sm text-[#544F46] leading-relaxed font-medium">
                        <li><strong className="text-[#284E38] font-black">Active Recall:</strong> Instead of passive reading, Eklavya forces memory retrieval via end-of-chat checkpoints and flashcards, proven to halt the Ebbinghaus Forgetting Curve.</li>
                        <li><strong className="text-[#284E38] font-black">Cognitive Load Theory:</strong> Complex English textbooks overload working memory for Hindi/Hinglish speakers. Eklavya translates context natively, freeing mental capacity for actual comprehension.</li>
                      </ul>
                    </div>
                    <div className="bg-[#EBF2EC] p-8 rounded-3xl border border-[#C5D9C8] shadow-lg">
                      <h3 className="font-black text-[#1E3626] text-xl mb-4 flex items-center gap-3"><BookOpen className="w-6 h-6 text-[#284E38]"/> The Solution</h3>
                      <p className="text-sm text-[#3D3A36] leading-relaxed mb-6 font-medium">A complete ecosystem that ingests standard curriculum PDFs, vectorizes them, and provides a conversational AI mentor that speaks the student's exact dialect.</p>
                      <div className="flex flex-wrap gap-3">
                        <span className="text-[11px] font-black uppercase tracking-widest bg-white text-[#284E38] px-4 py-2 rounded-xl shadow-sm border border-[#C5D9C8]">Zero Hallucinations</span>
                        <span className="text-[11px] font-black uppercase tracking-widest bg-white text-[#284E38] px-4 py-2 rounded-xl shadow-sm border border-[#C5D9C8]">Native Voice APIs</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-8">
                    <h3 className="font-black text-2xl text-[#1E3626] text-center">System Data Flow (DFD)</h3>
                    <div className="bg-white p-10 rounded-3xl border border-[#E3DDCF] shadow-xl flex flex-col items-center">
                      <div className="flex flex-col md:flex-row items-center gap-6 w-full justify-between max-w-3xl">
                        <div className="bg-[#FAF8F5] p-5 rounded-2xl border border-[#D9D3C7] text-center w-full md:w-36 shadow-sm"><FileText className="w-8 h-8 text-[#8C6D23] mx-auto mb-3"/><span className="text-[11px] font-black uppercase tracking-widest block">1. PDF Upload</span></div>
                        <ArrowRight className="w-8 h-8 text-[#C5D9C8] rotate-90 md:rotate-0"/>
                        <div className="bg-[#EBF2EC] p-5 rounded-2xl border border-[#C5D9C8] text-center w-full md:w-36 shadow-sm"><SquareSquare className="w-8 h-8 text-[#284E38] mx-auto mb-3"/><span className="text-[11px] font-black uppercase tracking-widest block">2. pgvector DB</span></div>
                        <ArrowRight className="w-8 h-8 text-[#C5D9C8] rotate-90 md:rotate-0"/>
                        <div className="bg-[#FAF8F5] p-5 rounded-2xl border border-[#D9D3C7] text-center w-full md:w-36 shadow-sm"><Mic className="w-8 h-8 text-[#8C6D23] mx-auto mb-3"/><span className="text-[11px] font-black uppercase tracking-widest block">3. User Query</span></div>
                        <ArrowRight className="w-8 h-8 text-[#C5D9C8] rotate-90 md:rotate-0"/>
                        <div className="bg-[#1E3626] p-5 rounded-2xl border border-[#284E38] text-center w-full md:w-36 text-white shadow-md"><Sparkles className="w-8 h-8 text-white mx-auto mb-3"/><span className="text-[11px] font-black uppercase tracking-widest block">4. Groq LLM</span></div>
                      </div>
                    </div>
                  </div>
                </div>
             </div>
          )}

        </div>
      </main>
    </div>
  );
}