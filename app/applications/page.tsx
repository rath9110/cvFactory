import Link from "next/link";
import ApplicationsList from "./applications-list-client";

export default function ApplicationsPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Applications</h1>
          <p className="mt-1 text-sm text-stone-600">
            Every session you have saved. Click into one to see the brief, the
            cover letter you actually sent, and the feedback you captured.
          </p>
        </div>
        <nav className="flex gap-4 text-sm font-medium text-stone-600">
          <Link href="/" className="underline-offset-4 hover:underline">
            ← Analyzer
          </Link>
          <Link href="/learn" className="underline-offset-4 hover:underline">
            Learning →
          </Link>
        </nav>
      </header>
      <ApplicationsList />
    </main>
  );
}
