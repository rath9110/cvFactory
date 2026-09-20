import PageHeader from "../page-header";
import ProfileClient from "./profile-client";

export default function Page() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <PageHeader
        title="Master profile"
        description="What every generation runs against. Edit data/master_profile.json by hand for structural changes, and revert applied learnings from here."
        current="/profile"
      />
      <ProfileClient />
    </main>
  );
}
