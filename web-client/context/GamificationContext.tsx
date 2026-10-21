"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";

interface GamificationContextType {
  xp: number;
  streak: number;
  addXP: (amount: number) => void;
  pomoSeconds: number;
  pomoRunning: boolean;
  togglePomo: () => void;
  resetPomo: () => void;
}

const GamificationContext = createContext<GamificationContextType>({
  xp: 0,
  streak: 1,
  addXP: () => {},
  pomoSeconds: 25 * 60,
  pomoRunning: false,
  togglePomo: () => {},
  resetPomo: () => {},
});

export const GamificationProvider = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoaded } = useUser();
  const [xp, setXp] = useState(150);
  const [streak, setStreak] = useState(3);
  const [pomoSeconds, setPomoSeconds] = useState(25 * 60);
  const [pomoRunning, setPomoRunning] = useState(false);

  useEffect(() => {
    if (isLoaded && user) {
      const storedXp = localStorage.getItem(`eklavya_xp_${user.id}`);
      if (storedXp) setXp(parseInt(storedXp, 10));
    }
  }, [isLoaded, user]);

  const addXP = (amount: number) => {
    setXp((prev) => {
      const next = prev + amount;
      if (user) localStorage.setItem(`eklavya_xp_${user.id}`, next.toString());
      return next;
    });
  };

  useEffect(() => {
    if (!pomoRunning) return;
    const interval = setInterval(() => {
      setPomoSeconds((prev) => {
        if (prev <= 1) {
          setPomoRunning(false);
          addXP(50);
          return 25 * 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [pomoRunning]);

  return (
    <GamificationContext.Provider
      value={{
        xp,
        streak,
        addXP,
        pomoSeconds,
        pomoRunning,
        togglePomo: () => setPomoRunning((r) => !r),
        resetPomo: () => {
          setPomoRunning(false);
          setPomoSeconds(25 * 60);
        },
      }}
    >
      {children}
    </GamificationContext.Provider>
  );
};

export const useGamification = () => useContext(GamificationContext);