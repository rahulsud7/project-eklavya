"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export type LanguageMode = "Hinglish" | "Hindi" | "English";

interface LanguageContextType {
  language: LanguageMode;
  setLanguage: (lang: LanguageMode) => void;
  voiceLangCode: string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: "Hinglish",
  setLanguage: () => {},
  voiceLangCode: "hi-IN",
});

export const LanguageProvider = ({ children }: { children: React.ReactNode }) => {
  const [language, setLanguageState] = useState<LanguageMode>("Hinglish");

  useEffect(() => {
    const saved = localStorage.getItem("eklavya_lang") as LanguageMode;
    if (saved) setLanguageState(saved);
  }, []);

  const setLanguage = (lang: LanguageMode) => {
    setLanguageState(lang);
    localStorage.setItem("eklavya_lang", lang);
  };

  const voiceLangCode = language === "English" ? "en-IN" : "hi-IN";

  return (
    <LanguageContext.Provider value={{ language, setLanguage, voiceLangCode }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);