"use client";
import React from "react";

export function Button({ children, variant="primary", size="md", className="", ...props }: any) {
  const base = "inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed";
  const variants: any = {
    primary: "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-200",
    secondary: "bg-white border border-slate-200 hover:bg-slate-50 text-slate-800",
    ghost: "hover:bg-slate-100 text-slate-700",
    danger: "bg-red-50 hover:bg-red-100 text-red-700 border border-red-200",
  };
  const sizes: any = { sm: "px-3 py-1.5 text-sm", md: "px-4 py-2.5 text-sm", lg: "px-6 py-3 text-[15px]", icon: "w-9 h-9 p-0" };
  return <button className={`${base} ${variants[variant]||variants.primary} ${sizes[size]||sizes.md} ${className}`} {...props}>{children}</button>;
}

export function Card({ children, className="", ...props }: any) {
  return <div className={`bg-white rounded-2xl border border-slate-200/70 shadow-sm ${className}`} {...props}>{children}</div>;
}

export function Badge({ children, variant="default", className=""}:{children:React.ReactNode, variant?:string, className?:string}) {
  const map:any = {
    default: "bg-slate-100 text-slate-700",
    success: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    processing: "bg-amber-50 text-amber-700 border border-amber-200",
    failed: "bg-red-50 text-red-700 border border-red-200",
    indigo: "bg-indigo-50 text-indigo-700 border border-indigo-200",
  };
  return <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${map[variant]||map.default} ${className}`}>{children}</span>;
}

export function Spinner({ size=16 }: { size?:number }) {
  return <div style={{width:size,height:size}} className="animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600" />;
}
