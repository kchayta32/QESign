"use client";

import React from "react";
import { Track, TrackType } from "@/types";
import { Cpu, Code2, Network, Database, Users, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";

interface TrackSelectorProps {
  tracks: Track[];
  selectedTrack: TrackType;
  onSelectTrack: (trackId: TrackType) => void;
  disabled?: boolean;
}

const trackIcons: Record<string, React.ElementType> = {
  Cpu: Cpu,
  Code2: Code2,
  Network: Network,
  Database: Database,
};

export default function TrackSelector({
  tracks,
  selectedTrack,
  onSelectTrack,
  disabled = false,
}: TrackSelectorProps) {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm md:text-base font-bold font-display text-neutral-charcoal flex items-center gap-2">
            <span>เลือกแทร็กความเชี่ยวชาญ (Specialization Track)</span>
          </h3>
          <p className="text-xs text-neutral-500">
            เลือกแทร็กที่ตรงกับหัวข้อโครงงานและการสอบวัดคุณสมบัติ
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {tracks.map((track) => {
          const isSelected = selectedTrack === track.id;
          const Icon = trackIcons[track.iconName] || Cpu;
          const remainingQuota = track.quotaTotal - track.activeBookingsCount;
          const quotaPercentage = Math.round((track.activeBookingsCount / track.quotaTotal) * 100);

          return (
            <motion.div
              key={track.id}
              whileHover={disabled ? {} : { y: -3, transition: { duration: 0.15 } }}
              whileTap={disabled ? {} : { scale: 0.98 }}
              onClick={() => !disabled && onSelectTrack(track.id)}
              className={`relative cursor-pointer rounded-2xl p-4 transition-all border-2 ${
                isSelected
                  ? "bg-white shadow-soft border-ssru-crimson ring-4 ring-ssru-crimson/10"
                  : "bg-white hover:bg-neutral-50/80 border-neutral-200/80 shadow-sm"
              } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
            >
              {/* Active Selected Indicator */}
              {isSelected && (
                <div className="absolute top-3 right-3 text-ssru-crimson">
                  <CheckCircle2 className="w-5 h-5 fill-ssru-crimson text-white" />
                </div>
              )}

              {/* Track Header & Icon */}
              <div className="flex items-start gap-3 mb-2.5">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    track.id === "HW"
                      ? "bg-amber-100 text-amber-700"
                      : track.id === "SW"
                      ? "bg-blue-100 text-blue-700"
                      : track.id === "NW"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-purple-100 text-purple-700"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0 pr-5">
                  <span className="text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-md uppercase inline-block mb-0.5 font-mono"
                    style={{
                      backgroundColor: `${track.color}15`,
                      color: track.color,
                    }}
                  >
                    Track: {track.code}
                  </span>
                  <h4 className="text-xs font-bold text-neutral-charcoal truncate">
                    {track.nameTh}
                  </h4>
                </div>
              </div>

              {/* Description */}
              <p className="text-[11px] text-neutral-500 line-clamp-2 mb-3 min-h-[32px] leading-relaxed">
                {track.descriptionTh}
              </p>

              {/* Quota & Active Booking Badge */}
              <div className="pt-2 border-t border-neutral-100">
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="text-neutral-500 font-medium">จองแล้ว / โควตา</span>
                  <span className="font-bold text-neutral-charcoal">
                    {track.activeBookingsCount} / {track.quotaTotal} ที่นั่ง
                  </span>
                </div>
                {/* Progress bar */}
                <div className="w-full h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${quotaPercentage}%`,
                      backgroundColor: track.color,
                    }}
                  />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
