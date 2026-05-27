import Link from "next/link";
import LearnClient from "./learn-client";

export default function LearnPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Learning</h1>
          <p className="mt-1 text-sm text-stone-600">
            Phase 4 — read your saved applications, surface patterns, promote them
            into the master profile.
          </p>
        </div>
        <nav className="flex gap-4 text-sm font-medium text-stone-600">
          <Link href="/" className="underline-offset-4 hover:underline">
            ← Analyzer
          </Link>
          <Link href="/profile" className="underline-offset-4 hover:underline">
            Profile
          </Link>
          <Link
            href="/applications"
            className="underline-offset-4 hover:underline"
          >
            Applications
          </Link>
        </nav>
      </header>
      <LearnClient />
    </main>
  );
}
