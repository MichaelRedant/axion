import { NextResponse } from "next/server";
import { getServerMaximaEndpoint } from "@/app/axion/lib/algebra/maxima/config";
import { normalizeMaximaPayload } from "@/app/axion/lib/algebra/maxima/parser";

type MaximaProxyRequest = {
  readonly expression: string;
  readonly format?: string;
};

export async function POST(request: Request) {
  const endpoint = getServerMaximaEndpoint();
  if (!endpoint) {
    return NextResponse.json({ ok: false, error: "Maxima niet geconfigureerd" }, { status: 503 });
  }

  let body: MaximaProxyRequest;
  try {
    body = (await request.json()) as MaximaProxyRequest;
  } catch {
    return NextResponse.json({ ok: false, error: "Ongeldige JSON" }, { status: 400 });
  }

  const expression = typeof body.expression === "string" ? body.expression.trim() : "";
  if (!expression) {
    return NextResponse.json({ ok: false, error: "Lege expressie" }, { status: 400 });
  }

  const format = typeof body.format === "string" ? body.format : "plain";

  const upstream = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expression, format }),
    cache: "no-store",
  });

  const text = await upstream.text();
  const parsed = tryParseJson(text);

  if (!upstream.ok) {
    const normalized = normalizeMaximaPayload(parsed ?? text);
    if (!normalized.ok) {
      return NextResponse.json({ ok: false, error: normalized.error, diagnostics: normalized.diagnostics }, {
        status: upstream.status,
      });
    }

    return NextResponse.json(
      { ok: false, error: `Maxima antwoord ${upstream.status}`, diagnostics: normalized.diagnostics },
      { status: upstream.status },
    );
  }

  return NextResponse.json({ ok: true, result: parsed ?? text });
}

export async function GET() {
  const endpoint = getServerMaximaEndpoint();
  return NextResponse.json({ ok: true, available: Boolean(endpoint) });
}

function tryParseJson(text: string): unknown {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}
