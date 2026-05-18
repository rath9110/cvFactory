import AnalyzerClient from "./analyzer-client";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">CV Factory</h1>
        <p className="mt-1 text-sm text-stone-600">
          Phase 1 — paste a job ad to produce an honest strategic brief against your master profile.
        </p>
      </header>
      <AnalyzerClient />
    </main>
  );
}
