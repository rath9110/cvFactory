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
        <Link
          href="/"
          className="text-sm font-medium text-stone-600 underline-offset-4 hover:underline"
        >
          ← Back to analyzer
        </Link>
      </header>
      <LearnClient />
    </main>
  );
}
