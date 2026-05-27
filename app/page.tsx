import Link from "next/link";
import AnalyzerClient from "./analyzer-client";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">CV Factory</h1>
          <p className="mt-1 text-sm text-stone-600">
            Paste a job ad to produce a strategic brief, then generate a tailored CV
            and an honest cover letter.
          </p>
        </div>
        <nav className="flex gap-4 text-sm font-medium text-stone-600">
          <Link href="/profile" className="underline-offset-4 hover:underline">
            Profile
          </Link>
          <Link
            href="/applications"
            className="underline-offset-4 hover:underline"
          >
            Applications
          </Link>
          <Link href="/learn" className="underline-offset-4 hover:underline">
            Learning →
          </Link>
        </nav>
      </header>
      <AnalyzerClient />
    </main>
  );
}
