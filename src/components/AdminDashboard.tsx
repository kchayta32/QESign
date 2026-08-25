"use client";

import React, { useState } from "react";
import { dbStore } from "@/lib/firebase/db";
import { formatThaiDate } from "@/lib/utils";
import {
  ShieldCheck,
  Users,
  GraduationCap,
  Calendar,
  Layers,
  Award,
  Download,
  Settings,
  Plus,
  CheckCircle2,
  XCircle,
  Building2,
  FileSpreadsheet
} from "lucide-react";

export default function AdminDashboard() {
  const tracks = dbStore.getTracks();
  const students = dbStore.getStudents();
  const teachers = dbStore.getTeachers();
  const rounds = dbStore.getExamRounds();
  const qeResults = dbStore.getQEResults();
  const qeBookings = dbStore.getQEBookings();

  const passedStudents = students.filter(
    (s) => dbStore.getStudentEligibility(s.id).isFinalEligible
  ).length;

  const passRate = students.length > 0 ? Math.round((passedStudents / students.length) * 100) : 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Admin Header */}
      <div className="bg-white rounded-3xl p-6 md:p-8 shadow-soft border border-neutral-200/80">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-gradient-to-br from-neutral-900 to-neutral-800 flex items-center justify-center text-amber-400 shadow-md">
              <ShieldCheck className="w-8 h-8 md:w-10 md:h-10" />
            </div>
            <div>
              <div className="flex items-center space-x-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-neutral-900 text-white">
                  ผู้ดูแลระบบ / ประธานสาขา
                </span>
                <span className="text-xs text-neutral-400">ระบบบริหารจัดการภาพรวม</span>
              </div>
              <h2 className="text-lg md:text-2xl font-bold font-display text-neutral-charcoal">
                แดชบอร์ดผู้ดูแลระบบสาขาวิชาวิศวกรรมคอมพิวเตอร์
              </h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                Computer Engineering Administrative &amp; Examination Command Center
              </p>
            </div>
          </div>

          <button
            onClick={() => alert("กำลังส่งออกรายงานผลการสอบ QE และโครงงานฉบับสมบูรณ์ (CSV/Excel)...")}
            className="px-4 py-2.5 bg-ssru-crimson hover:bg-ssru-600 text-white rounded-2xl text-xs font-bold flex items-center space-x-2 shadow-sm transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>ส่งออกรายงานภาพรวม (Excel)</span>
          </button>
        </div>

        {/* 4 Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-neutral-100">
          <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200">
            <span className="text-neutral-400 text-xs block font-medium">นักศึกษาในระบบ</span>
            <span className="text-xl md:text-2xl font-bold text-neutral-charcoal font-display">
              {students.length} คน
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-ssru-50/50 border border-ssru-crimson/20">
            <span className="text-ssru-crimson text-xs block font-semibold">จองสอบ QE รวม</span>
            <span className="text-xl md:text-2xl font-bold text-ssru-crimson font-display">
              {qeBookings.length} คำร้อง
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200">
            <span className="text-emerald-800 text-xs block font-semibold">ปลดล็อก Final แล้ว (3/3)</span>
            <span className="text-xl md:text-2xl font-bold text-emerald-700 font-display">
              {passedStudents} คน ({passRate}%)
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200">
            <span className="text-neutral-400 text-xs block font-medium">อาจารย์ผู้ประเมิน</span>
            <span className="text-xl md:text-2xl font-bold text-neutral-charcoal font-display">
              {teachers.length} ท่าน
            </span>
          </div>
        </div>
      </div>

      {/* Track Quotas & Exam Rounds Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Track Capacity Card */}
        <div className="bg-white rounded-3xl p-6 shadow-soft border border-neutral-200 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
            <div className="flex items-center space-x-2">
              <Layers className="w-5 h-5 text-ssru-crimson" />
              <h3 className="text-sm md:text-base font-bold font-display text-neutral-charcoal">
                โควตาและจำนวนที่นั่งสอบประจำแต่ละแทร็ก
              </h3>
            </div>
          </div>

          <div className="space-y-3">
            {tracks.map((track) => (
              <div key={track.id} className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200">
                <div className="flex items-center justify-between mb-1.5 text-xs">
                  <span className="font-bold text-neutral-charcoal">
                    {track.code}: {track.nameTh}
                  </span>
                  <span className="font-bold text-ssru-crimson">
                    {track.activeBookingsCount} / {track.quotaTotal} ที่นั่ง
                  </span>
                </div>
                <div className="w-full bg-neutral-200 h-2 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.round((track.activeBookingsCount / track.quotaTotal) * 100)}%`,
                      backgroundColor: track.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Exam Rounds Schedule Card */}
        <div className="bg-white rounded-3xl p-6 shadow-soft border border-neutral-200 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
            <div className="flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-ssru-crimson" />
              <h3 className="text-sm md:text-base font-bold font-display text-neutral-charcoal">
                รอบการสอบและห้องสอบที่เปิดใช้งาน
              </h3>
            </div>
          </div>

          <div className="space-y-3">
            {rounds.map((round) => (
              <div key={round.id} className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-neutral-charcoal">{round.titleTh}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    เปิดรับลงทะเบียน
                  </span>
                </div>
                <div className="text-neutral-500 space-y-1 text-[11px]">
                  <p>ช่วงเวลาสอบ: {round.startDate} ถึง {round.endDate}</p>
                  <p>ห้องสอบ: {round.availableRooms.join(", ")}</p>
                  <p>ช่วงเวลาในแต่ละวัน: {round.slotsPerDay.join(", ")} น.</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
