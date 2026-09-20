"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const from = params.get("from") ?? "/";
  const [token, setToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, from }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `HTTP ${res.status}`);
        setSubmitting(false);
        return;
      }
      router.push(data.redirect_to ?? "/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input
        type="password"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        placeholder="Auth token"
        autoFocus
        className="w-full rounded-md border border-stone-300 bg-white p-3 text-sm shadow-sm focus:border-stone-500 focus:outline-none"
      />
      <button
        type="submit"
        disabled={submitting || token.length === 0}
        className="w-full border border-stone-900 bg-stone-900 px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-white hover:bg-white hover:text-stone-900 disabled:cursor-not-allowed disabled:border-stone-300 disabled:bg-stone-300 disabled:text-white"
      >
        {submitting ? "Signing in…" : "Sign in"}
      </button>
      {error && <p className="text-sm text-rose-700">{error}</p>}
    </form>
  );
}
