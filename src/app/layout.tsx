import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "DocuMind AI — Intelligent Document Q&A",
  description: "Upload documents and ask questions with AI. Understand research papers, technical docs, and reports instantly.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-[#f8f9fc] text-slate-900 antialiased selection:bg-indigo-200 selection:text-indigo-900">
        {children}
      </body>
    </html>
  );
}
