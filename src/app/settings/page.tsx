"use client";
import { useState, useEffect } from "react";
import { Sidebar, MobileBottomNav } from "@/components/Navigation";
import { Card, Button, Badge } from "@/components/ui";
import { Trash2, Moon, Sun, Monitor, Shield, Database, Cpu, HardDrive, AlertTriangle, CheckCircle2, Info } from "lucide-react";

export default function SettingsPage() {
  const [theme, setTheme] = useState("light");
  const [health, setHealth] = useState<any>(null);
  const [docs, setDocs] = useState<any[]>([]);
  const [clearing, setClearing] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(()=>{
    let active = true;
    const themeTimer = window.setTimeout(() => {
      const saved = localStorage.getItem("documind-theme");
      if (active && saved && ["light", "dark", "system"].includes(saved)) setTheme(saved);
    }, 0);
    fetch("/api/health")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not load service status.");
        if (active) setHealth(data);
      })
      .catch((error: unknown) => {
        if (active) setLoadError(error instanceof Error ? error.message : "Could not load service status.");
      });
    fetch("/api/documents")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not load documents.");
        if (!Array.isArray(data.documents)) throw new Error("The documents API returned an invalid response.");
        if (active) setDocs(data.documents);
      })
      .catch((error: unknown) => {
        if (active) setLoadError(error instanceof Error ? error.message : "Could not load documents.");
      });
    return () => {
      active = false;
      window.clearTimeout(themeTimer);
    };
  }, []);

  const setThemePref = (t:string) => { setTheme(t); localStorage.setItem("documind-theme", t); };

  const clearAll = async () => {
    if (!confirm(`Delete all ${docs.length} documents, extracted text, chunks, citations, and conversations from this app's shared storage? This cannot be undone.`)) return;
    setClearing(true);
    const failedIds: string[] = [];
    const failedNames: string[] = [];
    for (const doc of docs) {
      try {
        const res = await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Delete request failed.");
      } catch (error) {
        failedIds.push(doc.id);
        failedNames.push(`${doc.filename}: ${error instanceof Error ? error.message : "Delete request failed."}`);
      }
    }
    setDocs((current) => current.filter((doc) => failedIds.includes(doc.id)));
    setClearing(false);
    setLoadError(failedNames.join(" "));
    if (failedNames.length === 0) alert("All documents cleared");
  };

  return (
    <div className="min-h-screen bg-[#f8f9fc] flex">
      <Sidebar active="settings" />
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-[64px] bg-white border-b border-slate-200 flex items-center px-6 sticky top-0">
          <h1 className="font-semibold">Settings</h1>
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-20 lg:pb-8 max-w-[900px]">
          {loadError && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{loadError}</div>}
          {/* Theme */}
          <Card className="p-6">
            <h2 className="font-semibold flex items-center gap-2"><Monitor className="w-5 h-5 text-indigo-600"/> Appearance</h2>
            <p className="text-sm text-slate-500 mt-1">Choose your preferred theme</p>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {[
                { id: "light", label: "Light", icon: Sun, desc: "Default bright theme" },
                { id: "dark", label: "Dark", icon: Moon, desc: "Easy on eyes (planned)" },
                { id: "system", label: "System", icon: Monitor, desc: "Follow OS setting" },
              ].map(t=>(
                <button key={t.id} onClick={()=>setThemePref(t.id)} className={`p-4 rounded-2xl border text-left transition ${theme===t.id ? "bg-indigo-50 border-indigo-200 ring-2 ring-indigo-100" : "bg-white border-slate-200 hover:border-slate-300"}`}>
                  <t.icon className={`w-5 h-5 ${theme===t.id ? "text-indigo-600" : "text-slate-500"}`} />
                  <div className="font-medium text-sm mt-2">{t.label}</div>
                  <div className="text-xs text-slate-500">{t.desc}</div>
                </button>
              ))}
            </div>
            <div className="mt-4 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-3 flex gap-2"><Info className="w-4 h-4 shrink-0"/> Light theme is fully supported. Dark mode preference is saved and will enable full dark UI in a future update.</div>
          </Card>

          {/* AI Provider */}
          <Card className="p-6 mt-6">
            <h2 className="font-semibold flex items-center gap-2"><Cpu className="w-5 h-5 text-violet-600"/> AI Provider Status</h2>
            <div className="mt-4 grid sm:grid-cols-2 gap-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div className="text-xs text-slate-500 uppercase tracking-widest">Provider</div>
                <div className="font-medium mt-1 flex items-center gap-2">
                  {health?.aiProvider==="gemini" ? <><span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"/> Google Gemini 1.5 Flash</> : <><span className="w-2 h-2 bg-amber-500 rounded-full"/> Demo Mock (no key)</>}
                </div>
                <div className="text-xs text-slate-500 mt-2">Modular provider — swap in OpenAI/Groq by updating <code className="bg-white px-1 py-0.5 rounded border">src/lib/ai/provider.ts</code></div>
                <div className="mt-3">
                  {health?.aiProvider==="gemini" ? <Badge variant="success">Active — streaming enabled</Badge> : <Badge variant="processing">Demo mode — contextual fallback</Badge>}
                </div>
              </div>
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                <div className="text-xs text-indigo-700 uppercase tracking-widest font-semibold">How to enable Gemini</div>
                <ol className="mt-2 text-sm text-slate-700 space-y-1 list-decimal list-inside">
                  <li>Get free API key from <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-indigo-600 underline">AI Studio</a></li>
                  <li>Add <code className="bg-white px-1.5 py-0.5 rounded border text-xs">GEMINI_API_KEY=your_key</code> to <code className="bg-white px-1 py-0.5 rounded border text-xs">.env</code></li>
                  <li>Redeploy — no code change needed</li>
                </ol>
                <div className="mt-3 text-xs text-slate-500">Streaming uses SSE via <code>gemini-1.5-flash:streamGenerateContent</code>. Mock streams word-by-word if key missing.</div>
              </div>
            </div>
            <div className="mt-4 flex gap-2 text-xs">
              <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-full">Safety: BLOCK_NONE for document content</span>
              <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-full">Timeout: 60s</span>
              <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-full">No secrets exposed to client</span>
            </div>
          </Card>

          {/* Storage & DB */}
          <Card className="p-6 mt-6">
            <h2 className="font-semibold flex items-center gap-2"><Database className="w-5 h-5 text-emerald-600"/> Storage & Database</h2>
            <div className="mt-4 grid sm:grid-cols-3 gap-3">
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="text-xs text-slate-500">Architecture</div>
                <div className="font-medium text-sm mt-1">PostgreSQL + Drizzle</div>
                <div className="text-xs text-slate-500 mt-1">Documents • Chunks • Conversations • Messages</div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="text-xs text-slate-500">Persistence</div>
                <div className="font-medium text-sm mt-1">{health?.status==="ok" ? (health.environment==="demo" ? "In-memory demo storage" : "Connected ✓") : "Checking..."}</div>
                <div className="text-xs text-slate-500 mt-1">{health?.environment==="demo" ? "Data is cleared when the local server restarts." : "Persistent PostgreSQL storage."}</div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="text-xs text-slate-500">Retrieval</div>
                <div className="font-medium text-sm mt-1">Keyword TF + phrase boost</div>
                <div className="text-xs text-slate-500 mt-1">Top-5 chunks, 900 chars, 150 overlap</div>
              </div>
            </div>
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0"/> Demo mode uses in-memory storage. For persistent storage, set <code className="bg-white px-1 rounded border">DATABASE_URL</code> to a PostgreSQL connection string.
            </div>
          </Card>

          {/* Data management */}
          <Card className="p-6 mt-6">
            <h2 className="font-semibold flex items-center gap-2"><HardDrive className="w-5 h-5 text-slate-700"/> Privacy, Retention & Data Management</h2>
            <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-950">
              <p><strong>Retention:</strong> Documents stay in storage until you delete them. No automatic expiration is configured. Demo in-memory data is cleared when the server restarts; PostgreSQL data persists until deleted.</p>
              <p className="mt-2"><strong>AI processing:</strong> With a Gemini API key configured, retrieved passages and your question are sent to Google to generate an answer. Without a key, the contextual demo responder runs in this app server. OCR runs on this server; Tesseract.js may download its English language model on first use and cache it in the operating-system temporary directory.</p>
              <p className="mt-2"><strong>Deletion:</strong> Use the button below to remove all documents, extracted text, chunks, citations, and related conversations from the configured app database. This demo has shared storage and no per-user data isolation.</p>
            </div>
            <div className="mt-4 flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <div>
                <div className="font-medium text-sm">Documents in storage</div>
                <div className="text-xs text-slate-500">{docs.length} document(s) • {(docs.reduce((a,b)=>a+(b.size||0),0)/1024/1024).toFixed(2)} MB total</div>
              </div>
              <Badge variant="default">{docs.filter(d=>d.status==="completed").length} ready</Badge>
            </div>
            <div className="mt-4 flex gap-3">
              <Button variant="danger" size="sm" onClick={clearAll} disabled={clearing || docs.length===0}><Trash2 className="w-4 h-4"/>{clearing ? "Clearing..." : "Clear All Documents"}</Button>
              <div className="text-xs text-slate-500 flex items-center">Deletes all stored documents and their extracted content, chunks, citations, and conversations.</div>
            </div>
          </Card>

          {/* Security */}
          <Card className="p-6 mt-6">
            <h2 className="font-semibold flex items-center gap-2"><Shield className="w-5 h-5 text-emerald-600"/> Security</h2>
            <div className="mt-4 space-y-2 text-sm">
              {[
                "API keys stored server-side only (process.env) — never in browser bundle",
                ".env.local in .gitignore — no secrets committed",
                "Server-side file extension, size, and non-empty validation",
                "Prompt injection resistance — document content treated as untrusted data",
                "Input sanitization & request size limits (15MB, 2000 char questions)",
                "No sensitive logs — document content not logged",
              ].map(s=>(
                <div key={s} className="flex gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5"/><span className="text-slate-600">{s}</span></div>
              ))}
            </div>
          </Card>

          {/* App info */}
          <Card className="p-6 mt-6">
            <h2 className="font-semibold">About DocuMind AI</h2>
            <div className="mt-3 text-sm text-slate-600 leading-relaxed">
              <p>DocuMind AI is a document-workspace demo built with Next.js App Router, Drizzle ORM, PostgreSQL, and optional Gemini. It extracts page-aware PDF text, OCRs scanned pages, and streams answers with source passages.</p>
              <p className="mt-3">Limitations: Retrieval uses keyword scoring rather than embeddings; OCR is English-only. This app has no login or per-user authorization: anyone who can access it can manage the shared documents.</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className="px-3 py-1.5 bg-slate-900 text-white rounded-full">Next.js 16.2</span>
              <span className="px-3 py-1.5 bg-white border border-slate-200 rounded-full">Drizzle 0.45</span>
              <span className="px-3 py-1.5 bg-white border border-slate-200 rounded-full">Framer Motion</span>
              <span className="px-3 py-1.5 bg-white border border-slate-200 rounded-full">Tailwind 4.1</span>
            </div>
          </Card>

          <div className="mt-6 text-center text-xs text-slate-400">© 2026 DocuMind AI • Built as a complete full-stack project • Secure by design</div>
        </main>
        <MobileBottomNav active="settings" />
      </div>
    </div>
  );
}
