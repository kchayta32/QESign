"use client";

import React from "react";
import { useAuth } from "@/context/AuthContext";
import StudentDashboard from "@/components/StudentDashboard";
import TeacherDashboard from "@/components/TeacherDashboard";
import AdminDashboard from "@/components/AdminDashboard";
import { motion, AnimatePresence } from "framer-motion";

export default function HomePage() {
  const { role } = useAuth();

  return (
    <div className="w-full">
      <AnimatePresence mode="wait">
        {role === "student" && (
          <motion.div
            key="student"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <StudentDashboard />
          </motion.div>
        )}

        {role === "teacher" && (
          <motion.div
            key="teacher"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <TeacherDashboard />
          </motion.div>
        )}

        {role === "admin" && (
          <motion.div
            key="admin"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <AdminDashboard />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
