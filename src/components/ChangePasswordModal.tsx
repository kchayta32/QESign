"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { MIN_PASSWORD_LENGTH } from "@/lib/security/password";
import { X, KeyRound, Eye, EyeOff, AlertCircle, CheckCircle2, Save } from "lucide-react";

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const inputCls = "w-full text-xs bg-white border border-neutral-300 rounded-xl p-2.5 pr-9 focus:outline-none focus:ring-2 focus:ring-ssru-crimson/20";

export default function ChangePasswordModal({ isOpen, onClose }: ChangePasswordModalProps) {
  const { changePassword } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const reset = () => {
    setCurrent("");
    setNext("");
    setConfirm("");
    setError("");
    setSuccess(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!current) return setError("กรุณากรอกรหัสผ่านปัจจุบัน");
    if (next.length < MIN_PASSWORD_LENGTH) return setError(`รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`);
    if (next !== confirm) return setError("รหัสผ่านใหม่และการยืนยันไม่ตรงกัน");
    setSaving(true);
    const res = await changePassword(current, next);
    setSaving(false);
    if (!res.success) {
      setError(res.error || "เปลี่ยนรหัสผ่านไม่สำเร็จ");
      return;
    }
    setSuccess(true);
    setTimeout(handleClose, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-neutral-200 overflow-hidden">
        <div className="p-5 border-b border-neutral-100 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <KeyRound className="w-5 h-5 text-ssru-crimson" />
            <h3 className="text-base font-bold font-display text-neutral-charcoal">เปลี่ยนรหัสผ่าน</h3>
          </div>
          <button onClick={handleClose} aria-label="ปิด" className="p-1.5 rounded-xl text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-red-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span className="font-bold">เปลี่ยนรหัสผ่านสำเร็จ บันทึกลง Firebase แล้ว</span>
            </div>
          )}

          {[
            { label: "รหัสผ่านปัจจุบัน", value: current, set: setCurrent, ac: "current-password" },
            { label: `รหัสผ่านใหม่ (อย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร)`, value: next, set: setNext, ac: "new-password" },
            { label: "ยืนยันรหัสผ่านใหม่", value: confirm, set: setConfirm, ac: "new-password" },
          ].map((f) => (
            <div key={f.label}>
              <label className="block font-bold text-neutral-700 mb-1">{f.label}</label>
              <div className="relative">
                <input type={show ? "text" : "password"} autoComplete={f.ac} value={f.value} onChange={(e) => f.set(e.target.value)} className={inputCls} />
                <button type="button" onClick={() => setShow(!show)} className="absolute right-2.5 top-2.5 text-neutral-400 hover:text-neutral-700" aria-label="แสดง/ซ่อนรหัสผ่าน">
                  {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ))}

          <div className="flex justify-end space-x-2 pt-3 border-t border-neutral-100">
            <button type="button" onClick={handleClose} className="px-4 py-2 rounded-xl font-semibold text-neutral-600 hover:bg-neutral-100">
              ยกเลิก
            </button>
            <button type="submit" disabled={saving || success} className="px-5 py-2 rounded-xl font-bold text-white bg-ssru-crimson hover:bg-ssru-600 disabled:opacity-60 flex items-center space-x-1.5 shadow-sm">
              <Save className="w-4 h-4" />
              <span>{saving ? "กำลังบันทึก..." : "บันทึกรหัสผ่านใหม่"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
