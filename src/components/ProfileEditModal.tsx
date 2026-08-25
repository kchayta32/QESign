"use client";

import React, { useState } from "react";
import { Student } from "@/types";
import { dbStore } from "@/lib/firebase/db";
import {
  X,
  User,
  Upload,
  Camera,
  Save,
  CheckCircle2,
  Phone,
  BookOpen
} from "lucide-react";

interface ProfileEditModalProps {
  student: Student;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (updatedStudent: Student) => void;
}

export default function ProfileEditModal({
  student,
  isOpen,
  onClose,
  onSaved,
}: ProfileEditModalProps) {
  const [firstNameTh, setFirstNameTh] = useState(student.firstNameTh);
  const [lastNameTh, setLastNameTh] = useState(student.lastNameTh);
  const [phone, setPhone] = useState(student.phone || "");
  const [projectTitleTh, setProjectTitleTh] = useState(student.projectTitleTh || "");
  const [avatarUrl, setAvatarUrl] = useState(student.avatarUrl || "");

  if (!isOpen) return null;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          setAvatarUrl(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = dbStore.updateStudentProfile(student.id, {
      firstNameTh,
      lastNameTh,
      phone,
      projectTitleTh,
      avatarUrl,
    });
    if (updated) {
      onSaved(updated);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-neutral-200 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-neutral-100 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <User className="w-5 h-5 text-ssru-crimson" />
            <h3 className="text-base font-bold font-display text-neutral-charcoal">
              แก้ไขข้อมูลโปรไฟล์นักศึกษา
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="p-5 space-y-4 text-xs">
          {/* Avatar Edit */}
          <div className="flex items-center space-x-4 p-3 bg-neutral-50 rounded-2xl border border-neutral-200">
            <img
              src={avatarUrl}
              alt={firstNameTh}
              className="w-16 h-16 rounded-2xl object-cover border-2 border-ssru-crimson shadow-sm"
            />
            <div>
              <label className="px-3 py-1.5 rounded-xl bg-white border border-neutral-300 text-xs font-bold text-neutral-700 hover:bg-neutral-100 cursor-pointer inline-flex items-center gap-1.5 shadow-sm">
                <Upload className="w-3.5 h-3.5" />
                <span>เปลี่ยนรูปโปรไฟล์</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
              <p className="text-[10px] text-neutral-400 mt-1">รองรับ JPG, PNG</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-neutral-700 mb-1">ชื่อ (ภาษาไทย)</label>
              <input
                type="text"
                value={firstNameTh}
                onChange={(e) => setFirstNameTh(e.target.value)}
                className="w-full bg-white border border-neutral-300 rounded-xl p-2.5"
                required
              />
            </div>
            <div>
              <label className="block font-bold text-neutral-700 mb-1">นามสกุล (ภาษาไทย)</label>
              <input
                type="text"
                value={lastNameTh}
                onChange={(e) => setLastNameTh(e.target.value)}
                className="w-full bg-white border border-neutral-300 rounded-xl p-2.5"
                required
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-neutral-700 mb-1">เบอร์โทรศัพท์ติดต่อ</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="089-123-4567"
              className="w-full bg-white border border-neutral-300 rounded-xl p-2.5"
            />
          </div>

          <div>
            <label className="block font-bold text-neutral-700 mb-1">
              ชื่อหัวข้อโครงงาน (Project Title)
            </label>
            <textarea
              rows={2}
              value={projectTitleTh}
              onChange={(e) => setProjectTitleTh(e.target.value)}
              className="w-full bg-white border border-neutral-300 rounded-xl p-2.5"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-neutral-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl font-semibold text-neutral-600 hover:bg-neutral-100"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl font-bold text-white bg-ssru-crimson hover:bg-ssru-600 flex items-center space-x-1.5 shadow-sm"
            >
              <Save className="w-4 h-4" />
              <span>บันทึกข้อมูล</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
