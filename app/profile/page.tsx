import Link from "next/link";
import ProfileClient from "./profile-client";

export default function ProfilePage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Master profile</h1>
          <p className="mt-1 text-sm text-stone-600">
            What every generation runs against. Edit <code>data/master_profile.json</code> by
            hand for structural changes — revert auto-applied learnings from here.
          </p>
        </div>
        <nav className="flex gap-4 text-sm font-medium text-stone-600">
          <Link href="/" className="underline-offset-4 hover:underline">
            ← Analyzer
          </Link>
          <Link href="/applications" className="underline-offset-4 hover:underline">
            Applications
          </Link>
          <Link href="/learn" className="underline-offset-4 hover:underline">
            Learning
          </Link>
        </nav>
      </header>
      <ProfileClient />
    </main>
  );
}
