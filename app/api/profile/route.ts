import { NextResponse } from "next/server";
import { loadProfile } from "@/lib/load-profile";

export const runtime = "nodejs";

export async function GET() {
  const profile = await loadProfile();
  return NextResponse.json({ profile });
}
