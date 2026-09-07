"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { studentCodeFromEmail } from "@/lib/institution";
import { GraduationCap, Users, ShieldCheck, LogIn, Eye, EyeOff, AlertCircle, Info } from "lucide-react";

type LoginRole = "student" | "teacher" | "admin";

interface LoginFormProps {
  onSuccess?: () => void;
  compact?: boolean;
}

const ROLE_META: Record<LoginRole, { label: string; idLabel: string; placeholder: string; Icon: React.ElementType }> = {
  student: {
    label: "นักศึกษา",
    idLabel: "รหัสนักศึกษา หรือ อีเมลมหาวิทยาลัย",
    placeholder: "เช่น 66122519001 หรือ 66122519001@ssru.ac.th",
    Icon: GraduationCap,
  },
  teacher: {
    label: "อาจารย์",
    idLabel: "รหัสอาจารย์ หรือ อีเมลอาจารย์",
    placeholder: "เช่น parinwat.th หรือ parinwat.th@ssru.ac.th",
    Icon: Users,
  },
  admin: {
    label: "ผู้ดูแลระบบ",
    idLabel: "รหัสผู้ดูแลระบบ หรือ อีเมล",
    placeholder: "รหัสผู้ดูแลระบบ",
    Icon: ShieldCheck,
  },
};

export default function LoginForm({ onSuccess, compact = false }: LoginFormProps) {
  const { login } = useAuth();
  const [roleType, setRoleType] = useState<LoginRole>("student");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const meta = ROLE_META[roleType];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!identifier.trim()) {
      setError("กรุณากรอกรหัสนักศึกษา / รหัสอาจารย์ หรืออีเมล");
      return;
    }
    if (!password) {
      setError("กรุณากรอกรหัสผ่าน");
      return;
    }
    setIsSubmitting(true);
    const res = await login(identifier, password, roleType);
    setIsSubmitting(false);
    if (!res.success) {
      setError(res.error || "เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบข้อมูล");
      return;
    }
    onSuccess?.();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {error && (
        <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div>
        <label className="block text-xs font-bold text-neutral-700 mb-2">เลือกประเภทผู้ใช้งาน</label>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(ROLE_META) as LoginRole[]).map((r) => {
            const { label, Icon } = ROLE_META[r];
            const active = roleType === r;
            return (
              <button
                key={r}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  if (studentCodeFromEmail(identifier) && r !== "student") {
                    setRoleType("student");
                    setError("อีเมลรหัสนักศึกษา 11 หลัก @ssru.ac.th ต้องเลือกประเภทนักศึกษา");
                    return;
                  }
                  setRoleType(r);
                  setError("");
                }}
                className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center space-x-1.5 transition-all ${
                  active
                    ? "bg-red-50 border-ssru-crimson text-ssru-crimson shadow-xs"
                    : "bg-neutral-50 border-neutral-200 text-neutral-600 hover:bg-neutral-100"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label htmlFor="login-identifier" className="block text-xs font-bold text-neutral-700 mb-1">
          {meta.idLabel} *
        </label>
        <input
          id="login-identifier"
          type="text"
          autoComplete="username"
          value={identifier}
          onChange={(e) => {
            setIdentifier(e.target.value);
            setError("");
            if (studentCodeFromEmail(e.target.value)) setRoleType("student");
          }}
          placeholder={meta.placeholder}
          className="w-full text-xs font-mono bg-white border border-neutral-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-ssru-crimson/20"
        />
      </div>

      <div>
        <label htmlFor="login-password" className="block text-xs font-bold text-neutral-700 mb-1">
          รหัสผ่าน (Password) *
        </label>
        <div className="relative">
          <input
            id="login-password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="กรอกรหัสผ่านของคุณ"
            className="w-full text-xs bg-white border border-neutral-300 rounded-xl p-3 pr-10 focus:outline-none focus:ring-2 focus:ring-ssru-crimson/20"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
            className="absolute right-3 top-3 text-neutral-400 hover:text-neutral-700"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full py-3 bg-gradient-to-r from-ssru-crimson to-ssru-600 hover:from-ssru-600 hover:to-ssru-dark disabled:opacity-60 text-white rounded-xl text-xs md:text-sm font-bold shadow-md shadow-ssru-crimson/20 flex items-center justify-center space-x-2 transition-all active:scale-98"
      >
        {isSubmitting ? (
          <span>กำลังตรวจสอบข้อมูล...</span>
        ) : (
          <>
            <LogIn className="w-4 h-4" />
            <span>เข้าสู่ระบบ (Sign In)</span>
          </>
        )}
      </button>

      {!compact && (
        <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200 text-[11px] text-neutral-600 leading-relaxed flex items-start space-x-2">
          <Info className="w-4 h-4 text-ssru-crimson flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-neutral-800">การเข้าใช้งานครั้งแรก</p>
            <p>
              นักศึกษา: ใช้ <span className="font-mono font-bold">รหัสนักศึกษา</span> เป็นทั้งชื่อผู้ใช้และรหัสผ่าน
              (เช่น 66122519001 / 66122519001)
            </p>
            <p>
              อาจารย์: ใช้ <span className="font-mono font-bold">รหัสอาจารย์</span> (ส่วนหน้า @ ของอีเมล) เป็นรหัสผ่าน
              (เช่น parinwat.th@ssru.ac.th / parinwat.th)
            </p>
            <p>ระบบจะให้กรอกข้อมูลโปรไฟล์และแนะนำให้ตั้งรหัสผ่านใหม่เมื่อเข้าใช้งานครั้งแรก หากลืมรหัสผ่านโปรดติดต่อผู้ดูแลระบบสาขาวิชาเพื่อรีเซ็ต</p>
          </div>
        </div>
      )}
    </form>
  );
}
