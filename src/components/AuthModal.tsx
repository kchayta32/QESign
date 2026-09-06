"use client";

import React from "react";
import { X, GraduationCap } from "lucide-react";
import LoginForm from "./LoginForm";
import { DEPARTMENT_CE_TH } from "@/lib/institution";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-3xl shadow-2xl border border-neutral-200 flex flex-col">
        <div className="p-5 md:p-6 border-b border-neutral-100 flex items-center justify-between sticky top-0 bg-white z-20">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-ssru-crimson to-ssru-dark flex items-center justify-center text-white shadow-md">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base md:text-lg font-bold font-display text-neutral-charcoal leading-tight">เข้าสู่ระบบ</h3>
              <p className="text-xs text-neutral-500">{DEPARTMENT_CE_TH}</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="ปิด" className="p-2 rounded-xl text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 md:p-6">
          <LoginForm onSuccess={onClose} />
        </div>
      </div>
    </div>
  );
}
