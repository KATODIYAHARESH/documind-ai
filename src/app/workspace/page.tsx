"use client";
import { useCallback, useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Sidebar, MobileBottomNav } from "@/components/Navigation";
import { Card, Badge, Button, Spinner } from "@/components/ui";
import { UploadZone } from "@/components/UploadZone";
import { Send, FileText, Trash2, Copy, Download, Sparkles, Bot, User, Square, Plus, MessageSquare, BookOpen, Zap, Clock, ChevronDown, PanelRightClose, PanelRightOpen, Check, AlertTriangle, X } from "lucide-react";

interface Doc { id:string; filename:string; size:number; status:string; chunkCount?:number; pageCount?:number; createdAt:string; preview?:string }
interface Msg { id:string; role:string; content:string; sources?:string; createdAt:string }
interface Conv { id:string; documentId:string; title:string; createdAt:string }
interface Source { chunkIndex:number; pageNumber?:number | null; heading?:string | null; preview:string }

async function fetchDocuments(): Promise<Doc[]> {
  const res = await fetch("/api/documents");
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not load documents.");
  if (!Array.isArray(data.documents)) throw new Error("The documents API returned an invalid response.");
  return data.documents;
}

async function fetchConversations(docId: string): Promise<Conv[]> {
  const res = await fetch(`/api/conversations?documentId=${encodeURIComponent(docId)}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not load conversations.");
  if (!Array.isArray(data.conversations)) throw new Error("The conversations API returned an invalid response.");
  return data.conversations;
}

async function fetchMessages(convId: string): Promise<Msg[]> {
  const res = await fetch(`/api/conversations/${convId}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Could not load conversation.");
  if (!Array.isArray(data.messages)) throw new Error("The conversation API returned an invalid response.");
  return data.messages;
}

function WorkspaceInner() {
  const searchParams = useSearchParams();
  const initialDoc = searchParams.get("doc");

  const [docs, setDocs] = useState<Doc[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<string | null>(initialDoc);
  const [conversations, setConversations] = useState<Conv[]>([]);
  const [activeConv, setActiveConv] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [question, setQuestion] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryType, setSummaryType] = useState("short");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [showRight, setShowRight] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const showToast = useCallback((msg:string) => { setToast(msg); setTimeout(()=>setToast(null), 2000); }, []);
  const loadDocs = useCallback(async () => {
    try {
      const loadedDocs = await fetchDocuments();
      setDocs(loadedDocs);
      setSelectedDoc((current) =>
        current && loadedDocs.some((doc) => doc.id === current)
          ? current
          : loadedDocs[0]?.id ?? null,
      );
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not load documents.");
    }
  }, [showToast]);
  const loadConvs = useCallback(async (docId: string) => {
    try {
      const loadedConversations = await fetchConversations(docId);
      setConversations(loadedConversations);
      setActiveConv(loadedConversations[0]?.id ?? null);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not load conversations.");
    }
  }, [showToast]);

  useEffect(() => {
    let active = true;
    fetchDocuments()
      .then((loadedDocs) => {
        if (!active) return;
        setDocs(loadedDocs);
        setSelectedDoc((current) =>
          current && loadedDocs.some((doc) => doc.id === current)
            ? current
            : loadedDocs[0]?.id ?? null,
        );
      })
      .catch((error: unknown) => {
        if (active) showToast(error instanceof Error ? error.message : "Could not load documents.");
      });
    return () => { active = false; };
  }, [showToast]);
  useEffect(() => {
    if (!selectedDoc) return;
    let active = true;
    fetchConversations(selectedDoc)
      .then((loadedConversations) => {
        if (!active) return;
        setConversations(loadedConversations);
        setActiveConv(loadedConversations[0]?.id ?? null);
      })
      .catch((error: unknown) => {
        if (active) showToast(error instanceof Error ? error.message : "Could not load conversations.");
      });
    return () => { active = false; };
  }, [selectedDoc, showToast]);
  useEffect(() => {
    if (!activeConv) return;
    let active = true;
    fetchMessages(activeConv)
      .then((loadedMessages) => { if (active) setMessages(loadedMessages); })
      .catch((error: unknown) => {
        if (active) showToast(error instanceof Error ? error.message : "Could not load conversation.");
      });
    return () => { active = false; };
  }, [activeConv, showToast]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, streamText]);

  const selectDocument = (docId:string) => {
    if (docId === selectedDoc) return;
    abortRef.current?.abort();
    setSelectedDoc(docId);
    setConversations([]);
    setActiveConv(null);
    setMessages([]);
    setSources([]);
    setSummary(null);
    setStreaming(false);
    setStreamText("");
  };
  const selectConversation = (convId:string) => {
    setActiveConv(convId);
    setMessages([]);
  };

  const handleAsk = async (q?: string) => {
    const text = q || question;
    if (!text.trim()) { showToast("Please enter a question"); return; }
    if (!selectedDoc) { showToast("Please select a document first"); return; }
    if (text.length > 2000) { showToast("Question too long"); return; }
    setQuestion(""); setStreaming(true); setStreamText(""); setSources([]);
    const controller = new AbortController();
    abortRef.current = controller;

    // optimistic user message
    const tempUser: Msg = { id: "temp-user", role: "user", content: text, createdAt: new Date().toISOString() };
    setMessages(prev=>[...prev, tempUser]);

    try {
      const res = await fetch(`/api/documents/${selectedDoc}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text, conversationId: activeConv }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const err = await res.json().catch(()=>({error:"Request failed"}));
        throw new Error(err.error || "Failed to get answer");
      }
      if (!res.body) throw new Error("No stream");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let full = "";
      let responseSources: Source[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const jsonStr = line.slice(5).trim();
          if (!jsonStr) continue;
          let evt: { type?: string; conversationId?: string; sources?: Source[]; text?: string; error?: string };
          try {
            evt = JSON.parse(jsonStr);
          } catch {
            continue;
          }
          if (evt.type === "meta") {
            if (evt.conversationId && !activeConv) setActiveConv(evt.conversationId);
            if (evt.sources) {
              responseSources = evt.sources;
              setSources(responseSources);
            }
          } else if (evt.type === "chunk") {
            full += evt.text ?? "";
            setStreamText(full);
          } else if (evt.type === "error") {
            throw new Error(evt.error || "Answer generation failed.");
          }
        }
      }
      if (full) {
        setMessages(prev=> [...prev.filter(m=>m.id!=="temp-user"), tempUser, { id: "ai-"+Date.now(), role: "assistant", content: full, createdAt: new Date().toISOString(), sources: JSON.stringify(responseSources)}]);
        // refresh conv list if new
        if (selectedDoc) void loadConvs(selectedDoc);
      } else {
        setMessages(prev=> prev.filter(m=>m.id!=="temp-user"));
        showToast("No answer generated");
      }
    } catch (e:any) {
      if (e.name === "AbortError") showToast("Generation cancelled");
      else showToast(e.message || "AI error");
      setMessages(prev=> prev.filter(m=>m.id!=="temp-user"));
    } finally {
      setStreaming(false); setStreamText(""); abortRef.current=null;
    }
  };

  const handleSummarize = async () => {
    if (!selectedDoc) return;
    setSummaryLoading(true); setSummary(null);
    try {
      const res = await fetch(`/api/documents/${selectedDoc}/summarize`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ type: summaryType })});
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSummary(data.summary);
    } catch(e:any){ showToast(e.message) }
    setSummaryLoading(false);
  };

  const clearChat = async () => {
    if (!activeConv) { setMessages([]); return; }
    if (!confirm("Clear this conversation?")) return;
    try {
      const res = await fetch("/api/conversations/"+activeConv, { method:"DELETE"});
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not clear this conversation.");
      setMessages([]);
      setActiveConv(null);
      if (selectedDoc) void loadConvs(selectedDoc);
      showToast("Conversation cleared");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not clear this conversation.");
    }
  };

  const copyText = (t:string) => { navigator.clipboard.writeText(t); showToast("Copied to clipboard"); };
  const downloadTxt = (t:string, name:string) => { const blob=new Blob([t],{type:"text/plain"}); const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=name; a.click(); URL.revokeObjectURL(url); showToast("Downloaded"); };

  const suggested = [
    "What is this document about?",
    "Explain the main concepts in simple English",
    "What are the important findings?",
    "Summarize the conclusion",
    "What are the limitations discussed?",
    "Find information about key methodology",
  ];

  const selectedDocObj = docs.find(d=>d.id===selectedDoc);

  return (
    <div className="min-h-screen bg-[#f8f9fc] flex">
      <Sidebar active="workspace" />
      <div className="flex-1 min-w-0 flex flex-col h-screen">
        {/* Top bar */}
        <header className="h-[56px] bg-white border-b border-slate-200 flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <MessageSquare className="w-5 h-5 text-indigo-600 hidden sm:block"/>
            <h1 className="font-semibold text-sm sm:text-[15px] truncate">Document Workspace</h1>
            {selectedDocObj && <span className="hidden md:inline-flex text-xs px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-100 truncate max-w-[200px]">{selectedDocObj.filename}</span>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={()=>setShowRight(!showRight)} className="p-2 rounded-xl hover:bg-slate-100 hidden lg:flex">{showRight ? <PanelRightClose className="w-4 h-4"/> : <PanelRightOpen className="w-4 h-4"/>}</button>
            <Link href="/dashboard" className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-medium hover:bg-slate-50">Dashboard</Link>
          </div>
        </header>

        <div className="flex flex-1 min-h-0">
          {/* Left sidebar - Documents & Conversations */}
          <aside className="w-[300px] shrink-0 bg-white border-r border-slate-200 hidden md:flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-sm">Documents</h2>
                <Link href="/dashboard" className="w-7 h-7 rounded-xl bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700"><Plus className="w-4 h-4"/></Link>
              </div>
              <p className="text-xs text-slate-500 mt-1">{docs.length} document(s) • Select to chat</p>
              <div className="pt-2 border-t border-slate-100">
                <div className="text-xs font-semibold text-slate-600 mb-2">Upload new</div>
                <UploadZone compact onUploadComplete={loadDocs} />
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {docs.length===0 ? (
                <div className="text-center py-8">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mx-auto"><FileText className="w-5 h-5 text-slate-400"/></div>
                  <p className="text-sm text-slate-500 mt-3">No documents</p>
                  <Link href="/dashboard" className="mt-2 inline-flex px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-xs">Upload</Link>
                </div>
              ) : docs.map(doc=>(
                <button key={doc.id} onClick={()=>selectDocument(doc.id)} className={`w-full text-left p-3 rounded-xl border transition flex gap-3 ${selectedDoc===doc.id ? "bg-indigo-50 border-indigo-200" : "bg-white border-slate-200 hover:border-slate-300"}`}>
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${selectedDoc===doc.id ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"}`}><FileText className="w-4.5 h-4.5"/></div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate leading-tight">{doc.filename}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{doc.chunkCount} chunks • {doc.pageCount} pages</div>
                    <Badge variant={doc.status==="completed"?"success":"processing"} className="mt-1">{doc.status}</Badge>
                  </div>
                </button>
              ))}
            </div>

            <div className="border-t border-slate-100 p-3">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest flex items-center justify-between">
                Conversations
                <span className="bg-slate-100 px-2 py-0.5 rounded-full text-[10px]">{conversations.length}</span>
              </h3>
              <div className="mt-3 space-y-1 max-h-[180px] overflow-y-auto">
                {conversations.length===0 ? <p className="text-xs text-slate-400 py-4 text-center">No conversations yet. Ask a question to start.</p> :
                  conversations.map(c=>(
                    <button key={c.id} onClick={()=>selectConversation(c.id)} className={`w-full text-left px-3 py-2.5 rounded-xl text-sm flex items-center gap-2 border ${activeConv===c.id ? "bg-slate-900 text-white border-slate-900" : "bg-white hover:bg-slate-50 border-slate-200"}`}>
                      <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-60"/>
                      <span className="truncate flex-1">{c.title}</span>
                      {activeConv===c.id && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"/>}
                    </button>
                  ))
                }
              </div>
              <Button variant="secondary" size="sm" className="w-full mt-3" onClick={()=>{
                setActiveConv(null); setMessages([]);
              }}><Plus className="w-4 h-4"/> New Conversation</Button>
            </div>
          </aside>

          {/* Main chat */}
          <main className="flex-1 min-w-0 flex flex-col bg-[#fcfcff] relative">
            {/* Mobile doc selector */}
            <div className="md:hidden p-3 bg-white border-b border-slate-200 flex gap-2 overflow-x-auto">
              {docs.map(d=>(
                <button key={d.id} onClick={()=>selectDocument(d.id)} className={`px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap border ${selectedDoc===d.id ? "bg-indigo-600 text-white border-indigo-600" : "bg-white border-slate-200"}`}>{d.filename.slice(0,18)}</button>
              ))}
              {docs.length===0 && <span className="text-xs text-slate-500 py-2">No docs — <Link href="/dashboard" className="text-indigo-600">Upload</Link></span>}
            </div>

            {!selectedDoc ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center"><FileText className="w-8 h-8 text-indigo-600"/></div>
                <h2 className="mt-4 font-semibold">Please upload a document before asking a question.</h2>
                <p className="text-sm text-slate-500 mt-2 max-w-[400px]">Select a document from the sidebar or upload a new one to start Q&A.</p>
                <Link href="/dashboard" className="mt-4 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium">Go to Dashboard</Link>
              </div>
            ) : (
              <>
                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
                  {messages.length===0 && !streaming && (
                    <div className="max-w-[640px] mx-auto">
                      <Card className="p-6 mt-4">
                        <h3 className="font-semibold flex items-center gap-2"><Sparkles className="w-5 h-5 text-indigo-600"/> Welcome to DocuMind Workspace</h3>
                        <p className="text-sm text-slate-600 mt-2">Ask questions grounded in <span className="font-medium">{selectedDocObj?.filename}</span>. The AI will cite sources and tell you when information is missing.</p>
                        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {suggested.map(q=>(
                            <button key={q} onClick={()=>handleAsk(q)} className="text-left px-3 py-2.5 rounded-xl bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 text-sm transition flex items-center gap-2">
                              <span className="w-6 h-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0"><Zap className="w-3.5 h-3.5 text-indigo-600"/></span>
                              <span className="truncate">{q}</span>
                            </button>
                          ))}
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2 text-xs">
                          <span className="px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-full text-amber-800">Try: Summarize button →</span>
                          <span className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-full">Sources appear on right →</span>
                        </div>
                      </Card>
                      <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-400">
                        <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5"/> Streaming enabled</span>
                        <span>•</span>
                        <span className="flex items-center gap-1"><BookOpen className="w-3.5 h-3.5"/> Top-5 retrieval</span>
                      </div>
                    </div>
                  )}

                  {messages.map(m=>(
                    <div key={m.id} className={`flex gap-3 max-w-[760px] mx-auto ${m.role==="user" ? "justify-end" : "justify-start"}`}>
                      {m.role==="assistant" && <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shrink-0 mt-1"><Bot className="w-4 h-4 text-white"/></div>}
                      <div className={`max-w-[85%] sm:max-w-[78%] rounded-2xl px-4 py-3 ${m.role==="user" ? "bg-slate-900 text-white rounded-br-sm" : "bg-white border border-slate-200 shadow-sm rounded-tl-sm"}`}>
                        <div className="flex items-center gap-2 mb-1 text-xs opacity-60">
                          {m.role==="user" ? <><User className="w-3 h-3"/> You</> : <><Sparkles className="w-3 h-3"/> DocuMind AI</>}
                          <span>•</span>
                          <span>{new Date(m.createdAt).toLocaleTimeString()}</span>
                        </div>
                        <div className={`prose prose-sm max-w-none ${m.role==="user" ? "text-white" : "text-slate-800"} whitespace-pre-wrap leading-relaxed text-[14px]`}>{m.content}</div>
                        {m.role==="assistant" && (
                          <div className="mt-3 flex gap-2">
                            <button onClick={()=>copyText(m.content)} className="px-2.5 py-1 rounded-full bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs flex items-center gap-1"><Copy className="w-3 h-3"/> Copy</button>
                            <button onClick={()=>downloadTxt(m.content, `answer-${m.id}.txt`)} className="px-2.5 py-1 rounded-full bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs flex items-center gap-1"><Download className="w-3 h-3"/> Download</button>
                          </div>
                        )}
                      </div>
                      {m.role==="user" && <div className="w-8 h-8 rounded-xl bg-slate-200 flex items-center justify-center shrink-0 mt-1"><User className="w-4 h-4"/></div>}
                    </div>
                  ))}

                  {streaming && (
                    <div className="flex gap-3 max-w-[760px] mx-auto">
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shrink-0"><Bot className="w-4 h-4 text-white"/></div>
                      <div className="flex-1 bg-white border border-slate-200 shadow-sm rounded-2xl rounded-tl-sm px-4 py-3">
                        <div className="flex items-center gap-2 text-xs text-slate-500 mb-2"><span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"/> Generating — streaming</div>
                        <div className="prose prose-sm whitespace-pre-wrap text-[14px] leading-relaxed">{streamText}<span className="inline-block w-2 h-4 bg-indigo-600 animate-pulse ml-0.5 align-middle"/></div>
                        {sources.length>0 && (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {sources.map((s,i)=><span key={i} className="px-2 py-1 bg-indigo-50 border border-indigo-100 rounded-full text-xs">Source {i+1}{s.pageNumber? ` • p.${s.pageNumber}`:""}</span>)}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef}/>
                </div>

                {/* Input */}
                <div className="p-3 sm:p-4 bg-white border-t border-slate-200 shrink-0">
                  <div className="max-w-[760px] mx-auto">
                    {streaming && (
                      <div className="mb-3 flex justify-center">
                        <button onClick={()=>{ abortRef.current?.abort(); setStreaming(false); }} className="px-4 py-2 rounded-full bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-sm flex items-center gap-2"><Square className="w-3.5 h-3.5"/> Stop generating</button>
                      </div>
                    )}
                    <div className="flex gap-2 items-end bg-slate-50 border border-slate-200 rounded-2xl p-2 focus-within:ring-2 focus-within:ring-indigo-200 focus-within:border-indigo-200 transition">
                      <textarea
                        value={question}
                        onChange={e=>setQuestion(e.target.value)}
                        onKeyDown={e=>{ if(e.key==="Enter" && !e.shiftKey){ e.preventDefault(); handleAsk(); }}}
                        placeholder={selectedDoc ? "Ask anything about this document... (Shift+Enter for new line)" : "Select a document first"}
                        disabled={!selectedDoc || streaming}
                        rows={1}
                        className="flex-1 bg-transparent px-3 py-2.5 text-sm placeholder:text-slate-400 focus:outline-none resize-none max-h-[120px] min-h-[44px]"
                      />
                      <button onClick={()=>handleAsk()} disabled={!question.trim() || streaming || !selectedDoc} className="w-10 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white flex items-center justify-center shrink-0">
                        <Send className="w-4 h-4"/>
                      </button>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                      <span className="hidden sm:inline">Press Enter to send • Shift+Enter for new line • Your question is grounded in the document</span>
                      <span className="flex items-center gap-2">
                        <button onClick={clearChat} className="hover:text-slate-700 flex items-center gap-1"><Trash2 className="w-3.5 h-3.5"/> Clear</button>
                        <span className="hidden sm:inline">• {question.length}/2000</span>
                      </span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </main>

          {/* Right sidebar - Details, Sources, Summary */}
          {showRight && selectedDoc && (
            <aside className="w-[360px] shrink-0 bg-white border-l border-slate-200 hidden lg:flex flex-col overflow-hidden">
              <div className="p-4 border-b border-slate-100">
                <h2 className="font-semibold text-sm flex items-center gap-2"><BookOpen className="w-4 h-4 text-indigo-600"/> Document Details</h2>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {selectedDocObj && (
                  <Card className="p-4">
                    <div className="flex gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center"><FileText className="w-5 h-5 text-white"/></div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{selectedDocObj.filename}</div>
                        <div className="text-xs text-slate-500">{(selectedDocObj.size/1024).toFixed(1)} KB • {selectedDocObj.chunkCount} chunks</div>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200"><div className="text-slate-500">Status</div><div className="font-medium capitalize">{selectedDocObj.status}</div></div>
                      <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200"><div className="text-slate-500">Pages</div><div className="font-medium">{selectedDocObj.pageCount}</div></div>
                    </div>
                    {selectedDocObj.preview && <div className="mt-3 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200 line-clamp-4">{selectedDocObj.preview}</div>}
                  </Card>
                )}

                {/* Summary panel */}
                <Card className="p-4">
                  <h3 className="font-semibold text-sm flex items-center gap-2"><Sparkles className="w-4 h-4 text-violet-600"/> Summary</h3>
                  <div className="mt-3">
                    <label className="text-xs text-slate-500">Summary type</label>
                    <div className="mt-1 relative">
                      <select value={summaryType} onChange={e=>setSummaryType(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm">
                        <option value="short">Short summary</option>
                        <option value="detailed">Detailed summary</option>
                        <option value="keypoints">Key points</option>
                        <option value="definitions">Important definitions</option>
                        <option value="findings">Main findings</option>
                        <option value="conclusions">Conclusions</option>
                        <option value="action">Action items</option>
                      </select>
                    </div>
                    <Button size="sm" className="w-full mt-3" onClick={handleSummarize} disabled={summaryLoading}>
                      {summaryLoading ? <><Spinner size={14}/> Generating...</> : "Generate Summary"}
                    </Button>
                    {summary && (
                      <div className="mt-3">
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm leading-relaxed whitespace-pre-wrap max-h-[280px] overflow-y-auto">{summary}</div>
                        <div className="mt-2 flex gap-2">
                          <button onClick={()=>copyText(summary)} className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs flex items-center justify-center gap-1 hover:bg-slate-50"><Copy className="w-3.5 h-3.5"/> Copy</button>
                          <button onClick={()=>downloadTxt(summary, `summary-${selectedDoc}.txt`)} className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs flex items-center justify-center gap-1 hover:bg-slate-50"><Download className="w-3.5 h-3.5"/> Download</button>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>

                {/* Sources */}
                <Card className="p-4">
                  <h3 className="font-semibold text-sm">Relevant Sections</h3>
                  <p className="text-xs text-slate-500 mt-1">Sources update when you ask a question</p>
                  {sources.length===0 ? (
                    <div className="mt-3 bg-slate-50 border border-dashed border-slate-200 rounded-xl p-4 text-center text-xs text-slate-500">
                      Ask a question to see retrieved passages here
                    </div>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {sources.map((s,i)=>(
                        <div key={i} className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                          <div className="text-xs font-medium text-indigo-700">Source {i+1} {s.pageNumber ? `• Page ${s.pageNumber}` : ""} {s.heading ? `• ${s.heading}`: ""}</div>
                          <div className="text-xs text-slate-600 mt-1 line-clamp-3">{s.preview}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 flex gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0"/> If answer is missing, try rephrasing with different keywords.
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-4 py-2.5 rounded-full text-sm shadow-lg flex items-center gap-2 z-50">
          <Check className="w-4 h-4 text-emerald-400"/> {toast}
        </div>
      )}
      <MobileBottomNav active="workspace" />
    </div>
  );
}

export default function WorkspacePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Spinner size={24}/></div>}>
      <WorkspaceInner />
    </Suspense>
  );
}
