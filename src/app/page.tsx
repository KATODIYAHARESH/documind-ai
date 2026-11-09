import Link from "next/link";
import { TopNav } from "@/components/Navigation";
import { FileText, MessageSquare, Zap, Search, BookOpen, Shield, ArrowRight, Sparkles, Check, Upload, Brain, Layers } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#fcfcff]">
      <TopNav />
      
      {/* Hero */}
      <section className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 pt-10 sm:pt-16 pb-12">
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              AI-Powered • PDF • DOCX • TXT
            </div>
            <h1 className="mt-6 text-[32px] sm:text-[44px] lg:text-[52px] font-[700] leading-[0.95] tracking-tight">
              Understand any
              <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent"> document</span> <br />
              without reading it all.
            </h1>
            <p className="mt-5 text-[16px] sm:text-[18px] leading-relaxed text-slate-600 max-w-[540px]">
              Upload research papers, technical docs, and reports. Ask questions in natural language and get grounded answers with sources — no hallucinations.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link href="/dashboard" className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-lg shadow-indigo-200 transition">
                Get Started Free <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/workspace" className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 font-medium">
                <MessageSquare className="w-4 h-4" /> Try Workspace
              </Link>
            </div>
            <div className="mt-6 flex items-center gap-6 text-sm text-slate-500">
              <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-500"/> No credit card</span>
              <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-500"/> Free tier Gemini</span>
              <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-500"/> Secure</span>
            </div>
          </div>
          
          {/* Preview card */}
          <div className="relative">
            <div className="absolute -inset-3 bg-gradient-to-br from-indigo-200 to-violet-200 rounded-[32px] blur-2xl opacity-40 hidden lg:block" />
            <div className="relative bg-white rounded-[24px] border border-slate-200 shadow-xl overflow-hidden">
              <div className="h-12 bg-slate-50 border-b border-slate-200 flex items-center px-4 gap-2">
                <div className="flex gap-1.5"><span className="w-3 h-3 rounded-full bg-red-400"/><span className="w-3 h-3 rounded-full bg-amber-400"/><span className="w-3 h-3 rounded-full bg-emerald-400"/></div>
                <span className="ml-3 text-xs font-medium text-slate-500">DocuMind Workspace — research-paper.pdf</span>
                <span className="ml-auto text-xs px-2 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">● Live</span>
              </div>
              <div className="p-5 space-y-4">
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">👤</div>
                  <div className="bg-slate-50 rounded-2xl rounded-tl-sm px-4 py-3 text-sm max-w-[80%] border border-slate-100">
                    What methodology is used in this paper?
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shrink-0"><Sparkles className="w-4 h-4 text-white"/></div>
                  <div className="bg-indigo-600 text-white rounded-2xl rounded-tl-sm px-4 py-3 text-sm max-w-[85%] leading-relaxed">
                    <div className="font-medium mb-1">According to the document (Source 2, Page 4):</div>
                    The study uses a mixed-methods approach combining qualitative interviews (n=42) with quantitative survey analysis...
                    <div className="mt-2 flex gap-2">
                      <span className="text-[11px] bg-white/20 px-2 py-1 rounded-full">Source 2</span>
                      <span className="text-[11px] bg-white/20 px-2 py-1 rounded-full">Confidence: high</span>
                    </div>
                  </div>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 flex items-center gap-3 border border-slate-200">
                  <FileText className="w-8 h-8 text-indigo-600 bg-white p-1.5 rounded-lg border border-slate-200" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">research-paper.pdf</div>
                    <div className="text-xs text-slate-500">12 pages • 5 chunks • Ready</div>
                  </div>
                  <span className="text-xs px-2 py-1 bg-emerald-50 text-emerald-700 rounded-full">Completed</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid md:grid-cols-3 gap-5">
          {[
            { icon: Upload, title: "Smart Upload", desc: "Drag & drop PDF, DOCX, TXT. Validated server-side. 15MB limit, 5 files at once.", color: "from-indigo-500 to-violet-500" },
            { icon: Brain, title: "Grounded Answers", desc: "Retrieves relevant chunks, cites sources, says when info is missing. No hallucinations.", color: "from-emerald-500 to-teal-500" },
            { icon: Zap, title: "Streaming & Summaries", desc: "Real-time SSE streaming, concise summaries, key points & definitions in one click.", color: "from-amber-500 to-orange-500" },
          ].map(f=>(
            <div key={f.title} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition">
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center shadow-sm`}>
                <f.icon className="w-5 h-5 text-white" />
              </div>
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="bg-white rounded-[24px] border border-slate-200 p-6 sm:p-10">
          <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
          <p className="text-slate-600 mt-2">Three steps to document intelligence</p>
          <div className="grid md:grid-cols-3 gap-8 mt-8">
            {[
              { n: "01", t: "Upload", d: "Drop your PDF, DOCX or TXT. We extract, clean, chunk (900 chars, 150 overlap) and store." },
              { n: "02", t: "Ask", d: "Select a document and ask natural questions. We retrieve top-5 relevant chunks." },
              { n: "03", t: "Receive", d: "Get streaming answers with sources, summaries, and copy/export tools." },
            ].map(s=>(
              <div key={s.n} className="relative">
                <div className="text-5xl font-bold text-slate-100">{s.n}</div>
                <h3 className="mt-2 font-semibold">{s.t}</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">{s.d}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap gap-2">
            {["PDF Text Extraction", "DOCX via Mammoth", "Chunking & Retrieval", "Gemini 1.5 Flash", "SSE Streaming", "Source Citations"].map(tag=>(
              <span key={tag} className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-full text-xs font-medium">{tag}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Supported formats & Benefits */}
      <section className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-6 grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="font-semibold flex items-center gap-2"><Layers className="w-5 h-5 text-indigo-600"/> Supported Formats</h3>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {[
              { ext: "PDF", desc: "Research papers, reports", icon: "📄" },
              { ext: "DOCX", desc: "Word documents", icon: "📝" },
              { ext: "TXT", desc: "Plain text, notes", icon: "📃" },
            ].map(f=>(
              <div key={f.ext} className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-center">
                <div className="text-2xl">{f.icon}</div>
                <div className="mt-2 font-semibold text-sm">{f.ext}</div>
                <div className="text-xs text-slate-500">{f.desc}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 text-xs text-slate-500 bg-amber-50 border border-amber-200 rounded-xl p-3">Password-protected PDFs and scanned image-only PDFs are detected and reported gracefully.</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="font-semibold flex items-center gap-2"><Search className="w-5 h-5 text-indigo-600"/> Perfect for</h3>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {["Students & Researchers", "Developers", "Teachers", "Business Analysts", "Project Docs", "Exam Prep"].map(b=>(
              <div key={b} className="flex items-center gap-2 text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
                <Check className="w-4 h-4 text-emerald-500 shrink-0" /> {b}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-10 border-t border-slate-200 mt-6">
        <div className="flex flex-col sm:flex-row justify-between gap-4 text-sm text-slate-500">
          <div>© 2026 DocuMind AI — Built with Next.js, Drizzle, Gemini. Secure & modular.</div>
          <div className="flex gap-4">
            <Link href="/dashboard" className="hover:text-slate-800">Dashboard</Link>
            <Link href="/workspace" className="hover:text-slate-800">Workspace</Link>
            <Link href="/settings" className="hover:text-slate-800">Settings</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
