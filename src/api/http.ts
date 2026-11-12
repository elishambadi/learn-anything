import { NextResponse } from "next/server";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function parseJsonBody<T>(
  raw: unknown,
  parser: { safeParse: (value: unknown) => { success: boolean } },
): T | null {
  const result = parser.safeParse(raw) as
    | { success: true; data: T }
    | { success: false };
  return result.success ? result.data : null;
}
