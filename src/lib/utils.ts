import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatThaiDate(dateString?: string): string {
  if (!dateString) return "-";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return new Intl.DateTimeFormat("th-TH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date);
  } catch {
    return dateString;
  }
}

export function formatThaiDateTime(dateString?: string): string {
  if (!dateString) return "-";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return new Intl.DateTimeFormat("th-TH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return dateString;
  }
}

export function getTrackBadgeStyle(trackId: string): {
  bg: string;
  text: string;
  border: string;
  dot: string;
  label: string;
} {
  switch (trackId) {
    case "HW":
      return {
        bg: "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800",
        text: "text-amber-700 dark:text-amber-400",
        border: "border-amber-300",
        dot: "bg-amber-500",
        label: "Hardware & Embedded",
      };
    case "SW":
      return {
        bg: "bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800",
        text: "text-blue-700 dark:text-blue-400",
        border: "border-blue-300",
        dot: "bg-blue-500",
        label: "Software Engineering",
      };
    case "NW":
      return {
        bg: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
        text: "text-emerald-700 dark:text-emerald-400",
        border: "border-emerald-300",
        dot: "bg-emerald-500",
        label: "Network & Cyber Security",
      };
    case "DB":
      return {
        bg: "bg-purple-50 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800",
        text: "text-purple-700 dark:text-purple-400",
        border: "border-purple-300",
        dot: "bg-purple-500",
        label: "Database & AI Systems",
      };
    default:
      return {
        bg: "bg-slate-50 text-slate-800 border-slate-200",
        text: "text-slate-700",
        border: "border-slate-300",
        dot: "bg-slate-500",
        label: trackId,
      };
  }
}
