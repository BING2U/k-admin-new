export type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function pickList(record: JsonRecord | null): unknown[] | null {
  if (!record) return null;
  const keys = [
    "items",
    "list",
    "records",
    "rows",
    "sources",
    "artists",
    "failures",
    "data",
    "result"
  ];
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) return value;
  }
  return null;
}

export function unwrapList<T extends JsonRecord>(payload: unknown): {
  items: T[];
  total: number;
  raw: unknown;
} {
  if (Array.isArray(payload)) {
    return { items: payload as T[], total: payload.length, raw: payload };
  }
  const root = asRecord(payload);
  const nested = asRecord(root?.data) ?? asRecord(root?.result) ?? root;
  const items = (pickList(nested) ?? pickList(root) ?? []) as T[];
  const total = Number(
    nested?.total ??
      nested?.totalCount ??
      nested?.count ??
      root?.total ??
      root?.totalCount ??
      items.length
  );
  return { items, total, raw: payload };
}

export function unwrapItem<T extends JsonRecord>(
  payload: unknown,
  fallbackId?: string
): T {
  if (Array.isArray(payload)) {
    return (payload[0] ?? { id: fallbackId }) as T;
  }
  const root = asRecord(payload);
  const data = root?.data ?? root?.result ?? root?.artist ?? payload;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return data as T;
  }
  return { id: fallbackId, value: data } as T;
}

export function str(record: JsonRecord | null | undefined, ...keys: string[]) {
  if (!record) return "";
  for (const key of keys) {
    const value = record[key];
    if (value == null || value === "") continue;
    if (typeof value === "object") continue;
    return String(value);
  }
  return "";
}

export function artistId(record: JsonRecord) {
  return str(record, "id", "artistId", "artist_id", "_id");
}

export function artistName(record: JsonRecord) {
  return str(
    record,
    "name",
    "displayName",
    "display_name",
    "nameZh",
    "name_zh",
    "nameKo",
    "name_ko",
    "nameEn",
    "name_en"
  );
}

export function artistCompany(record: JsonRecord) {
  return str(
    record,
    "company",
    "companyName",
    "company_name",
    "agency",
    "agencyName",
    "agency_name"
  );
}

export function formatCell(value: unknown) {
  if (value == null || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
