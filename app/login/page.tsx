import { Suspense } from "react";
import LoginForm from "./login-form";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
      <h1 className="mb-2 text-2xl font-semibold tracking-tight">CV Factory</h1>
      <p className="mb-6 text-sm text-stone-600">
        Single-user app. Enter the token configured as <code>APP_AUTH_TOKEN</code>{" "}
        on the server.
      </p>
      <Suspense fallback={<div className="text-sm text-stone-500">Loading…</div>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
