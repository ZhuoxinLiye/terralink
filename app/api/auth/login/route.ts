import { NextRequest, NextResponse } from "next/server";
import { setAuthCookie } from "@/lib/auth";

const BASE = process.env.NEXT_PUBLIC_TERRALINK_BASE_URL!;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const r = await fetch(`${BASE}/v1/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) return NextResponse.json(data, { status: r.status });
  // data.access_token is a JWT issued by the platform; frontend doesn't hold plaintext
  setAuthCookie(data.access_token);
  return NextResponse.json({ ok: true });
}
