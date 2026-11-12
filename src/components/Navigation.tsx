"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, LayoutDashboard, MessageSquare, Settings, Sparkles, Menu, X } from "lucide-react";
import { useState } from "react";

export function TopNav() {
  const [open, setOpen] = useState(false);
  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/70">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-[64px]">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-200">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="font-semibold text-[17px] tracking-tight">DocuMind AI</span>
          <span className="hidden sm:inline-flex ml-2 px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] font-semibold rounded-full border border-indigo-100 tracking-widest">BETA</span>
        </Link>
        
        <div className="hidden md:flex items-center gap-1">
          <Link href="/dashboard" className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-slate-100">Dashboard</Link>
          <Link href="/workspace" className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-slate-100">Workspace</Link>
          <Link href="/settings" className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-slate-100">Settings</Link>
        </div>
        
        <div className="hidden md:flex items-center gap-3">
          <Link href="/dashboard" className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 shadow-sm">Open Dashboard</Link>
        </div>
        
        <button onClick={()=>setOpen(!open)} className="md:hidden p-2 rounded-xl hover:bg-slate-100">
          {open ? <X className="w-5 h-5"/> : <Menu className="w-5 h-5"/>}
        </button>
      </div>
      {open && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 py-4 flex flex-col gap-2">
          <Link href="/dashboard" onClick={()=>setOpen(false)} className="px-3 py-2.5 rounded-xl hover:bg-slate-100 font-medium">Dashboard</Link>
          <Link href="/workspace" onClick={()=>setOpen(false)} className="px-3 py-2.5 rounded-xl hover:bg-slate-100 font-medium">Workspace</Link>
          <Link href="/settings" onClick={()=>setOpen(false)} className="px-3 py-2.5 rounded-xl hover:bg-slate-100 font-medium">Settings</Link>
          <Link href="/dashboard" onClick={()=>setOpen(false)} className="mt-2 px-4 py-3 rounded-xl bg-indigo-600 text-white text-center font-medium">Open Dashboard</Link>
        </div>
      )}
    </nav>
  );
}

export function Sidebar({ active }: { active: string }) {
  const items = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
    { id: "workspace", label: "Workspace", icon: MessageSquare, href: "/workspace" },
    { id: "documents", label: "Documents", icon: FileText, href: "/dashboard" },
    { id: "settings", label: "Settings", icon: Settings, href: "/settings" },
  ];
  return (
    <aside className="w-[260px] shrink-0 bg-white border-r border-slate-200 hidden lg:flex flex-col">
      <div className="p-5 flex items-center gap-3 border-b border-slate-100">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="font-semibold text-sm leading-none">DocuMind AI</div>
          <div className="text-xs text-slate-500">Document Intelligence</div>
        </div>
      </div>
      <nav className="p-4 flex-1 space-y-1">
        {items.map(i=>(
          <Link key={i.id} href={i.href} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${active===i.id ? "bg-indigo-50 text-indigo-700 border border-indigo-100" : "hover:bg-slate-50 text-slate-700"}`}>
            <i.icon className="w-4.5 h-4.5" />
            {i.label}
          </Link>
        ))}
        
        <div className="mt-6 p-4 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white">
          <div className="text-sm font-semibold">Need help?</div>
          <div className="text-xs opacity-80 mt-1 leading-relaxed">Upload your docs and start asking questions instantly.</div>
          <Link href="/workspace" className="mt-3 inline-flex px-3 py-1.5 bg-white text-indigo-600 rounded-xl text-xs font-semibold">Open Workspace</Link>
        </div>
      </nav>
      <div className="p-4 border-t border-slate-100">
        <div className="text-sm font-medium">Open access</div>
        <div className="text-xs text-slate-500">No account required</div>
      </div>
    </aside>
  );
}

export function MobileBottomNav({ active }: { active:string }) {
  const items = [
    { id: "dashboard", label: "Home", icon: LayoutDashboard, href: "/dashboard" },
    { id: "workspace", label: "Chat", icon: MessageSquare, href: "/workspace" },
    { id: "settings", label: "Settings", icon: Settings, href: "/settings" },
  ];
  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around py-2 z-40">
      {items.map(i=>(
        <Link key={i.id} href={i.href} className={`flex flex-col items-center gap-1 px-4 py-1.5 rounded-xl ${active===i.id ? "text-indigo-600" : "text-slate-500"}`}>
          <i.icon className="w-5 h-5" />
          <span className="text-[10px] font-medium">{i.label}</span>
        </Link>
      ))}
    </div>
  );
}
