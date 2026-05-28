import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AUTH_COOKIE, authToken, tokenMatches } from "@/lib/auth";

export const runtime = "nodejs";

const BodySchema = z.object({
  token: z.string().min(1),
  from: z.string().optional(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!authToken()) {
    return NextResponse.json(
      { error: "Auth not configured on the server" },
      { status: 503 }
    );
  }

  if (!tokenMatches(parsed.data.token)) {
    return NextResponse.json({ error: "Wrong token" }, { status: 401 });
  }

  const res = NextResponse.json({
    ok: true,
    redirect_to: parsed.data.from || "/",
  });
  res.cookies.set({
    name: AUTH_COOKIE,
    value: parsed.data.token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: AUTH_COOKIE,
    value: "",
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
  return res;
}
