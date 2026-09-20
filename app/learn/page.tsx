import PageHeader from "../page-header";
import LearnClient from "./learn-client";

export default function Page() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <PageHeader
        title="Learning"
        description="Patterns read across every saved application, and the rules they suggest adding to your master profile."
        current="/learn"
      />
      <LearnClient />
    </main>
  );
}
