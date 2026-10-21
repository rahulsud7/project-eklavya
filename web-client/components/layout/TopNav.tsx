"use client";

import Link from "next/link";
import { UserButton, SignInButton, SignUpButton, useUser } from "@clerk/nextjs";
import { useLanguage, LanguageMode } from "@/context/LanguageContext";
import { useGamification } from "@/context/GamificationContext";
import { BookOpen, Flame, Trophy, Timer, Play, Pause, RotateCcw, Languages, Mic, Sparkles } from "lucide-react";

export function TopNav() {
  const { isSignedIn } = useUser();
  const { language, setLanguage } = useLanguage();
  const { xp, streak, pomoSeconds, pomoRunning, togglePomo, resetPomo } = useGamification();

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  return (
    <header className="h-16 border-b border-slate-800 bg-slate-950/80 backdrop-blur px-6 flex items-center justify-between sticky top-0 z-50">
      <div className="flex items-center space-x-6">
        <Link href="/" className="flex items-center space-x-2.5">
          <div className="p-2 bg-indigo-600/20 border border-indigo-500/30 rounded-lg">
            <BookOpen className="w-5 h-5 text-indigo-400" />
          </div>
          <span className="font-bold text-lg tracking-tight text-white">Eklavya</span>
        </Link>

        <nav className="hidden md:flex items-center space-x-1 text-xs font-semibold">
          <Link href="/mentor" className="px-3 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-900 transition flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" /> 1-on-1 Mentor
          </Link>
          <Link href="/talk" className="px-3 py-2 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-slate-900 transition flex items-center gap-1.5">
            <Mic className="w-3.5 h-3.5" /> Talk Live
          </Link>
          <Link href="/study" className="px-3 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-900 transition">
            Study Arena
          </Link>
          <Link href="/roadmap" className="px-3 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-900 transition">
            Upload & Roadmap
          </Link>
        </nav>
      </div>

      <div className="flex items-center space-x-3">
        {/* Pomodoro Widget */}
        <div className="hidden sm:flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl text-xs">
          <Timer className="w-3.5 h-3.5 text-rose-400" />
          <span className="font-mono text-white">{formatTime(pomoSeconds)}</span>
          <button onClick={togglePomo} className="hover:text-white text-slate-400 cursor-pointer">
            {pomoRunning ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          </button>
          <button onClick={resetPomo} className="hover:text-white text-slate-400 cursor-pointer">
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>

        {/* Streak & XP */}
        <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-2.5 py-1.5 rounded-xl text-xs text-amber-400 font-semibold">
          <Flame className="w-3.5 h-3.5" />
          <span>{streak}d</span>
        </div>
        <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-2.5 py-1.5 rounded-xl text-xs text-emerald-400 font-semibold">
          <Trophy className="w-3.5 h-3.5" />
          <span>{xp} XP</span>
        </div>

        {/* Language Selector */}
        <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 px-2.5 py-1.5 rounded-xl text-xs">
          <Languages className="w-3.5 h-3.5 text-indigo-400" />
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as LanguageMode)}
            className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer"
          >
            <option value="Hinglish" className="bg-slate-900">Hinglish</option>
            <option value="Hindi" className="bg-slate-900">हिंदी</option>
            <option value="English" className="bg-slate-900">English</option>
          </select>
        </div>

        {/* Clerk User Authentication */}
        {isSignedIn ? (
          <UserButton appearance={{ elements: { avatarBox: "w-8 h-8" } }} />
        ) : (
          <div className="flex items-center space-x-2">
            <SignInButton mode="modal">
              <button className="text-xs px-3 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-200 cursor-pointer">
                Sign In
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium cursor-pointer">
                Sign Up
              </button>
            </SignUpButton>
          </div>
        )}
      </div>
    </header>
  );
}