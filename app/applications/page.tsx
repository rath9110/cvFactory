import PageHeader from "../page-header";
import ApplicationsList from "./applications-list-client";

export default function Page() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <PageHeader
        title="Applications"
        description="Every application you have saved as a reference. Open one to see the brief, the CV, and the feedback you captured."
        current="/applications"
      />
      <ApplicationsList />
    </main>
  );
}
