"use client";

import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useUser } from "@clerk/nextjs";
import { useLanguage } from "@/context/LanguageContext";
import { useGamification } from "@/context/GamificationContext";
import { TopNav } from "@/components/layout/TopNav";
import { Mic, MicOff, Volume2, Sparkles, AlertCircle } from "lucide-react";

export default function TalkToMentor() {
  const { user } = useUser();
  const { language, voiceLangCode } = useLanguage();
  const { addXP } = useGamification();

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = voiceLangCode;

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);

      recognition.onresult = (event: any) => {
        const spoken = event.results[0][0].transcript;
        setTranscript(spoken);
        handleVoiceQuery(spoken);
      };

      recognitionRef.current = recognition;
    }
  }, [voiceLangCode]);

  const speakText = (text: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    // Remove markdown symbols before speaking
    const cleanSpeech = text
      .replace(/[*#_`|]/g, "")
      .replace(/🎯.*$/, "")
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanSpeech);
    utterance.lang = voiceLangCode;
    utterance.rate = 1.0;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  const toggleMic = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in this browser. Please use Chrome.");
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      window.speechSynthesis.cancel();
      setTranscript("");
      recognitionRef.current.start();
    }
  };

  const handleVoiceQuery = async (queryText: string) => {
    setIsProcessing(true);
    try {
      const res = await axios.post("http://127.0.0.1:8000/api/query", {
        user_id: user?.id || "guest_student",
        subject: "General",
        query: queryText,
        language: language,
      });

      const reply = res.data.answer;
      setAiResponse(reply);
      speakText(reply);
      addXP(20);
    } catch {
      setAiResponse("Could not reach the RAG mentor backend. Check terminal.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <TopNav />

      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-2xl mx-auto space-y-8">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5" /> Hands-Free Live Mentorship ({language})
          </div>
          <h1 className="text-3xl font-extrabold text-white">Talk to Eklavya</h1>
          <p className="text-sm text-slate-400 mt-1">
            Tap the microphone and ask your doubts naturally in {language}.
          </p>
        </div>

        {/* Pulsing Voice Orb Button */}
        <div className="relative flex items-center justify-center">
          {(isListening || isSpeaking) && (
            <div className="absolute w-44 h-44 rounded-full bg-indigo-500/20 animate-ping" />
          )}
          <button
            onClick={toggleMic}
            disabled={isProcessing}
            className={`w-32 h-32 rounded-full flex items-center justify-center transition-all cursor-pointer relative z-10 shadow-2xl ${
              isListening
                ? "bg-rose-600 scale-105 shadow-rose-600/50"
                : isSpeaking
                ? "bg-emerald-600 shadow-emerald-600/50"
                : "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/40"
            }`}
          >
            {isListening ? (
              <MicOff className="w-12 h-12 text-white animate-pulse" />
            ) : isSpeaking ? (
              <Volume2 className="w-12 h-12 text-white animate-bounce" />
            ) : (
              <Mic className="w-12 h-12 text-white" />
            )}
          </button>
        </div>

        <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          {isListening
            ? "Listening... Speak now"
            : isProcessing
            ? "Thinking & retrieving context..."
            : isSpeaking
            ? "Eklavya is speaking (click mic to stop)..."
            : "Tap mic to speak"}
        </div>

        {/* Real-time Display Cards */}
        <div className="w-full space-y-4 text-left">
          {transcript && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">You Asked:</span>
              <p className="text-sm text-slate-200 mt-1 font-medium">{transcript}</p>
            </div>
          )}

          {aiResponse && (
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Eklavya Mentor:</span>
              <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">{aiResponse}</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}