import PageHeader from "./page-header";
import AnalyzerClient from "./analyzer-client";

export default function Page() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <PageHeader
        title="Draft a CV"
        description="Paste a job ad, then generate a CV tailored to the role and built only from what is in your profile."
        current="/"
      />
      <AnalyzerClient />
    </main>
  );
}
