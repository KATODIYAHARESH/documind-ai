"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Registration failed.");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-8 shadow-2xl">
        <div className="mb-6">
          <div className="inline-flex rounded-full border border-indigo-500/40 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-300">Create account</div>
          <h1 className="mt-4 text-3xl font-semibold text-white">Start with DocuMind</h1>
          <p className="mt-2 text-sm text-slate-400">Create a secure workspace for your documents.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-slate-300">Full name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-white outline-none placeholder:text-slate-500 focus:border-indigo-500" type="text" placeholder="Jane Doe" required />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-300">Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-white outline-none placeholder:text-slate-500 focus:border-indigo-500" type="email" placeholder="you@example.com" required />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-300">Password</label>
            <input value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-white outline-none placeholder:text-slate-500 focus:border-indigo-500" type="password" placeholder="At least 6 characters" required minLength={6} />
          </div>

          {error ? <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div> : null}

          <button type="submit" disabled={loading} className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60">{loading ? "Creating account..." : "Create account"}</button>
        </form>

        <div className="mt-5 text-center text-sm text-slate-400">Already have an account? <Link href="/login" className="font-medium text-indigo-300">Sign in</Link></div>
      </div>
    </main>
  );
}
