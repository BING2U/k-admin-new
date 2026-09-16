import { str, type JsonRecord } from "./envelope.ts";

/** Only http(s) official URLs. Never accept data:/blob: (those would be stored binaries). */
export function officialHttpUrl(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return trimmed;
  } catch {
    return "";
  }
}

/** API `avatar_url` — provenance text only; do not download, mirror, or render as a face photo. */
export function officialAvatarUrl(record: JsonRecord | null | undefined) {
  if (!record) return "";
  return officialHttpUrl(
    record.avatar_url ?? record.avatarUrl ?? record.avatar
  );
}

export function sourceUrl(record: JsonRecord | null | undefined) {
  if (!record) return "";
  return officialHttpUrl(
    record.source_url ?? record.sourceUrl ?? record.source
  );
}

export function fetchedAt(record: JsonRecord | null | undefined) {
  if (!record) return "";
  return str(record, "fetched_at", "fetchedAt", "fetched");
}
