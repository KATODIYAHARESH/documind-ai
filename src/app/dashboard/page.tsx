"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Sidebar, MobileBottomNav } from "@/components/Navigation";
import { Card, Badge, Button, Spinner } from "@/components/ui";
import { UploadZone } from "@/components/UploadZone";
import { FileText, Trash2, Sparkles, Clock, HardDrive, Search, CheckCircle2, FileUp } from "lucide-react";

interface Doc {
  id: string; filename: string; originalName: string; mimeType: string; size: number; status: string; pageCount?: number; chunkCount?: number; textLength?: number; preview?: string; createdAt: string;
}

async function fetchDocuments(): Promise<Doc[]> {
  const res = await fetch("/api/documents");
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not load documents.");
  if (!Array.isArray(data.documents)) throw new Error("The documents API returned an invalid response.");
  return data.documents;
}

export default function DashboardPage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async () => {
    try {
      setDocs(await fetchDocuments());
    } catch (error) {
      setDocs([]);
      setLoadError(error instanceof Error ? error.message : "Could not load documents.");
    } finally {
      setLoading(false);
    }
  }, []);
  const refresh = () => {
    setLoading(true);
    setLoadError("");
    void load();
  };
  useEffect(() => {
    let active = true;
    fetchDocuments()
      .then((loadedDocs) => { if (active) setDocs(loadedDocs); })
      .catch((error: unknown) => {
        if (active) {
          setDocs([]);
          setLoadError(error instanceof Error ? error.message : "Could not load documents.");
        }
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const delDoc = async (id:string) => {
    if (!confirm("Delete this document and all its conversations?")) return;
    try {
      const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not delete the document.");
      refresh();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not delete the document.");
    }
  };

  const filtered = docs.filter(d=> d.filename.toLowerCase().includes(search.toLowerCase()));

  const stats = {
    total: docs.length,
    completed: docs.filter(d=>d.status==="completed").length,
    totalChunks: docs.reduce((a,b)=>a+(b.chunkCount||0),0),
    totalSize: docs.reduce((a,b)=>a+(b.size||0),0),
  };

  return (
    <div className="min-h-screen bg-[#f8f9fc] flex">
      <Sidebar active="dashboard" />
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-[64px] bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-20">
          <h1 className="font-semibold">Dashboard</h1>
          <div className="flex items-center gap-2">
            <Link href="/workspace" className="hidden sm:inline-flex px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700">Open Workspace</Link>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-20 lg:pb-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Documents", value: stats.total, icon: FileText, color: "bg-indigo-50 text-indigo-600" },
              { label: "Completed", value: stats.completed, icon: CheckCircle2, color: "bg-emerald-50 text-emerald-600" },
              { label: "Chunks Indexed", value: stats.totalChunks, icon: HardDrive, color: "bg-violet-50 text-violet-600" },
              { label: "Storage Used", value: `${(stats.totalSize/1024/1024).toFixed(2)} MB`, icon: Clock, color: "bg-amber-50 text-amber-600" },
            ].map(s=>(
              <Card key={s.label} className="p-4 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.color}`}><s.icon className="w-5 h-5"/></div>
                <div><div className="text-lg font-semibold leading-none">{s.value}</div><div className="text-xs text-slate-500 mt-1">{s.label}</div></div>
              </Card>
            ))}
          </div>

          <Card className="mt-6 p-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="font-semibold flex items-center gap-2"><FileUp className="w-5 h-5 text-indigo-600"/> Upload Documents</h2>
              <span className="text-xs text-slate-500 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-full">PDF • DOCX • TXT • Max 15MB each • Max 5 files</span>
            </div>
            <UploadZone onUploadComplete={refresh} />
            <div className="mt-4 p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-xs text-indigo-800">
              <strong>Tip:</strong> Scanned PDFs are OCR-processed automatically. Clear, upright English scans produce the best results; all extraction errors are shown above.
            </div>
          </Card>

          <Card className="mt-6">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between gap-4 flex-wrap">
              <h2 className="font-semibold">Recent Documents</h2>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                  <input placeholder="Search documents..." value={search} onChange={e=>setSearch(e.target.value)} className="pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-white text-sm w-[200px] focus:outline-none focus:ring-2 focus:ring-indigo-200" />
                </div>
              </div>
            </div>

            {loadError ? (
              <div role="alert" className="p-6 text-center text-sm text-red-700">{loadError}</div>
            ) : loading ? (
              <div className="p-10 flex justify-center"><Spinner size={20}/></div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto"><FileText className="w-7 h-7 text-slate-400"/></div>
                <div className="mt-4 font-medium">No documents yet</div>
                <div className="text-sm text-slate-500 mt-1">Upload a PDF, DOCX or TXT to get started.</div>
                <div className="mt-4 flex justify-center gap-2 text-xs text-slate-400">
                  <span className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-full">Try: sample PDF</span>
                  <span className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-full">Try: research notes</span>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filtered.map(doc=>(
                  <div key={doc.id} className="p-4 flex items-center gap-4 hover:bg-slate-50 transition">
                    <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5 text-indigo-600"/>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{doc.filename}</div>
                      <div className="text-xs text-slate-500 flex flex-wrap gap-2 mt-1">
                        <span>{(doc.size/1024).toFixed(1)} KB</span>
                        <span>•</span>
                        <span>{doc.chunkCount||0} chunks</span>
                        <span>•</span>
                        <span>{doc.pageCount||1} pages</span>
                        <span>•</span>
                        <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                      </div>
                      {doc.preview && <div className="text-xs text-slate-500 truncate mt-1 max-w-[520px]">{doc.preview.slice(0,120)}...</div>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={doc.status==="completed" ? "success" : doc.status==="processing" ? "processing" : "failed"}>{doc.status}</Badge>
                      <Link href={`/workspace?doc=${doc.id}`} className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 hidden sm:inline-flex items-center gap-1"><Sparkles className="w-3.5 h-3.5"/> Ask</Link>
                      <button onClick={()=>delDoc(doc.id)} className="w-8 h-8 rounded-xl hover:bg-red-50 flex items-center justify-center text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4"/></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <div className="p-4 bg-slate-50/50 border-t border-slate-100 flex justify-between items-center">
              <span className="text-xs text-slate-500">Showing {filtered.length} document(s) • <Link href="/workspace" className="text-indigo-600 font-medium hover:underline">Go to Workspace →</Link></span>
              <Button variant="secondary" size="sm" onClick={refresh}>Refresh</Button>
            </div>
          </Card>

          <Card className="mt-6 p-6 bg-gradient-to-br from-indigo-600 to-violet-600 text-white border-0">
            <h3 className="font-semibold flex items-center gap-2"><Sparkles className="w-5 h-5"/> Quick Actions</h3>
            <div className="mt-4 grid sm:grid-cols-3 gap-3">
              <Link href="/workspace" className="bg-white/10 hover:bg-white/20 backdrop-blur rounded-xl p-4 border border-white/20">
                <div className="font-medium text-sm">Start Q&A</div>
                <div className="text-xs opacity-80 mt-1">Ask questions about your docs</div>
              </Link>
              <div className="bg-white/10 rounded-xl p-4 border border-white/20">
                <div className="font-medium text-sm">Summarize</div>
                <div className="text-xs opacity-80 mt-1">Short, detailed, key points & more</div>
              </div>
              <div className="bg-white/10 rounded-xl p-4 border border-white/20">
                <div className="font-medium text-sm">Copy & Export</div>
                <div className="text-xs opacity-80 mt-1">Copy answers or download as TXT</div>
              </div>
            </div>
          </Card>
        </main>
        <MobileBottomNav active="dashboard" />
      </div>
    </div>
  );
}
