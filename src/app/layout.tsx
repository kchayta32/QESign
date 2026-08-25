import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import Header from "@/components/Header";

export const metadata: Metadata = {
  title: "SSRU CE QE & Project Booking System | มรภ.สวนสุนันทา",
  description: "ระบบจองสอบวัดคุณสมบัติ (QE) และบริหารจัดการสิทธิ์สอบโครงงาน สาขาวิชาวิศวกรรมคอมพิวเตอร์ คณะเทคโนโลยีอุตสาหกรรม มหาวิทยาลัยราชภัฏสวนสุนันทา",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body className="min-h-screen bg-[#F8FAFC] text-neutral-charcoal antialiased flex flex-col selection:bg-red-100 selection:text-ssru-crimson">
        <AuthProvider>
          <Header />
          <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 md:py-8">
            {children}
          </main>
          <footer className="bg-white border-t border-neutral-200 py-6 text-center text-xs text-neutral-500">
            <div className="max-w-7xl mx-auto px-4 space-y-1">
              <p className="font-semibold text-neutral-charcoal">
                สาขาวิชาวิศวกรรมคอมพิวเตอร์ คณะเทคโนโลยีอุตสาหกรรม มหาวิทยาลัยราชภัฏสวนสุนันทา
              </p>
              <p className="text-[11px] text-neutral-400">
                SSRU Computer Engineering Qualifying Examination &amp; Final Defense Gate Platform • Firebase v10 Enabled
              </p>
            </div>
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
