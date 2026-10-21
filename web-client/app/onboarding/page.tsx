"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import axios from "axios";
import { useGamification } from "@/context/GamificationContext";
import { BookOpen, Check, GraduationCap } from "lucide-react";

const AVAILABLE_SUBJECTS = ["History", "Science", "Mathematics", "Computer Science", "Economics", "Geography", "Physics", "Chemistry"];
const CLASSES = ["Class 9", "Class 10", "Class 11", "Class 12", "BCA", "B.Tech", "MCA", "Other"];

export default function Onboarding() {
  const { user } = useUser();
  const router = useRouter();
  const { refreshProfile } = useGamification();
  
  const [classGrade, setClassGrade] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const handleFinish = async () => {
    if (!classGrade || selected.length === 0 || !user) return;
    setLoading(true);
    try {
      await axios.post(`${process.env.NEXT_PUBLIC_FASTAPI_URL || "http://127.0.0.1:8000"}/api/user/onboard`, {
        user_id: user.id,
        class_grade: classGrade,
        subjects: selected,
      });
      await refreshProfile();
      router.push("/");
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F4EE] flex flex-col items-center justify-center p-6">
      <div className="max-w-xl w-full bg-white border border-[#E3DDCF] rounded-3xl p-10 shadow-sm space-y-8">
        
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-[#EBF2EC] text-[#284E38] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <GraduationCap className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-extrabold text-[#1E3626]">Welcome to Eklavya</h1>
          <p className="text-[#696359]">Let's personalize your AI Mentor, {user?.firstName}.</p>
        </div>

        <div className="space-y-4 border-t border-[#E3DDCF] pt-6">
          <label className="text-sm font-bold text-[#1E3626] block">1. What are you currently studying?</label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {CLASSES.map((cls) => (
              <button
                key={cls} onClick={() => setClassGrade(cls)}
                className={`p-2.5 rounded-xl border text-xs font-semibold transition ${
                  classGrade === cls ? "bg-[#284E38] border-[#284E38] text-white" : "bg-[#FAF8F5] border-[#D9D3C7] text-[#544F46] hover:border-[#C5D9C8]"
                }`}
              >
                {cls}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4 border-t border-[#E3DDCF] pt-6">
          <div className="flex items-center justify-between">
            <label className="text-sm font-bold text-[#1E3626] block">2. Select Your Subjects</label>
            <span className="text-xs text-[#696359]">{selected.length}/4 Selected</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {AVAILABLE_SUBJECTS.map((sub) => {
              const isSelected = selected.includes(sub);
              return (
                <button
                  key={sub}
                  onClick={() => {
                    if (isSelected) setSelected(selected.filter((s) => s !== sub));
                    else if (selected.length < 4) setSelected([...selected, sub]);
                  }}
                  className={`p-2.5 rounded-xl border text-xs font-semibold transition flex items-center justify-between ${
                    isSelected ? "bg-[#EBF2EC] border-[#C5D9C8] text-[#1E3626]" : "bg-white border-[#D9D3C7] text-[#544F46] hover:bg-[#FAF8F5]"
                  }`}
                >
                  {sub} {isSelected && <Check className="w-3.5 h-3.5 text-[#284E38]" />}
                </button>
              );
            })}
          </div>
        </div>

        <button
          onClick={handleFinish}
          disabled={!classGrade || selected.length === 0 || loading}
          className="w-full py-4 bg-[#284E38] hover:bg-[#203F2D] disabled:opacity-50 text-white font-bold rounded-2xl transition shadow-md"
        >
          {loading ? "Configuring Dashboard..." : "Enter Study Arena"}
        </button>
      </div>
    </div>
  );
}