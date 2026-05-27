import Link from "next/link";
import ApplicationDetail from "./application-detail-client";

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <Link
            href="/applications"
            className="text-xs text-stone-500 underline-offset-2 hover:underline"
          >
            ← Applications
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Application detail
          </h1>
          <code className="text-xs text-stone-400">{id}</code>
        </div>
        <nav className="flex gap-4 text-sm font-medium text-stone-600">
          <Link href="/" className="underline-offset-4 hover:underline">
            Analyzer
          </Link>
          <Link href="/profile" className="underline-offset-4 hover:underline">
            Profile
          </Link>
          <Link href="/learn" className="underline-offset-4 hover:underline">
            Learning
          </Link>
        </nav>
      </header>
      <ApplicationDetail id={id} />
    </main>
  );
}
