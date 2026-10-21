"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import axios from "axios";
import { useRouter, usePathname } from "next/navigation";

interface GamificationContextType {
  xp: number;
  streak: number;
  subjects: string[];
  addXP: (amount: number) => void;
  refreshProfile: () => void;
  pomoSeconds: number;
  pomoRunning: boolean;
  togglePomo: () => void;
  resetPomo: () => void;
}

const GamificationContext = createContext<GamificationContextType>({} as any);

export const GamificationProvider = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoaded, isSignedIn } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  
  const [xp, setXp] = useState(0);
  const [streak, setStreak] = useState(0);
  const [subjects, setSubjects] = useState<string[]>([]);
  
  const [pomoSeconds, setPomoSeconds] = useState(25 * 60);
  const [pomoRunning, setPomoRunning] = useState(false);

  const fetchProfile = async () => {
    if (!user) return;
    try {
      const res = await axios.post("http://127.0.0.1:8000/api/user/sync", {
        user_id: user.id,
        name: user.fullName || "Student",
      });
      const data = res.data.profile;
      setXp(data.xp);
      setStreak(data.streak);
      setSubjects(data.subjects);

      if (data.subjects.length === 0 && pathname !== "/onboarding") {
        router.push("/onboarding");
      }
    } catch (err) {
      console.error("DB Sync failed", err);
    }
  };

  useEffect(() => {
    if (isLoaded && isSignedIn) fetchProfile();
  }, [isLoaded, isSignedIn]);

  const addXP = async (amount: number) => {
    setXp((prev) => prev + amount);
    // In production, send a PATCH request to Supabase here to save the new XP
  };

  // Pomodoro effect remains the same...
  useEffect(() => {
    if (!pomoRunning) return;
    const interval = setInterval(() => {
      setPomoSeconds((p) => {
        if (p <= 1) { setPomoRunning(false); addXP(50); return 25 * 60; }
        return p - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [pomoRunning]);

  return (
    <GamificationContext.Provider value={{ xp, streak, subjects, addXP, refreshProfile: fetchProfile, pomoSeconds, pomoRunning, togglePomo: () => setPomoRunning(!pomoRunning), resetPomo: () => { setPomoRunning(false); setPomoSeconds(25 * 60); } }}>
      {children}
    </GamificationContext.Provider>
  );
};

export const useGamification = () => useContext(GamificationContext);