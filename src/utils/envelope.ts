import { companyNameFromCode, formatCompanyLabel } from "./companyCodes.ts";

export type JsonRecord = Record<string, unknown>;

export function asRecord(value: unknown): JsonRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function looksLikeUuid(value: string) {
  return UUID_RE.test(value.trim());
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

export function unwrapList<T extends JsonRecord>(
  payload: unknown
): {
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
  return { id: fallbackId, value: data } as unknown as T;
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

const NESTED_NAME_KEYS = [
  "official_name",
  "officialName",
  "name",
  "text",
  "value",
  "displayName",
  "display_name",
  "title",
  "label",
  "ko",
  "en",
  "zh",
  "ja",
  "default"
];

export function humanFromUnknown(value: unknown): string {
  if (value == null || value === "") return "";
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    const text = String(value).trim();
    if (!text || looksLikeUuid(text)) return "";
    return text;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const text = humanFromUnknown(item);
      if (text) return text;
    }
    return "";
  }
  const rec = asRecord(value);
  if (!rec) return "";
  return humanStr(rec, ...NESTED_NAME_KEYS);
}

export function humanStr(
  record: JsonRecord | null | undefined,
  ...keys: string[]
) {
  if (!record) return "";
  for (const key of keys) {
    const text = humanFromUnknown(record[key]);
    if (text) return text;
  }
  return "";
}

export function artistId(record: JsonRecord) {
  return str(record, "id", "artistId", "artist_id", "_id");
}

export function artistName(record: JsonRecord) {
  return humanStr(
    record,
    "official_name",
    "officialName",
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

function nestedCompany(record: JsonRecord) {
  return (
    asRecord(record.company) ??
    asRecord(record.agency) ??
    asRecord(record.companyInfo) ??
    asRecord(record.company_info)
  );
}

export function artistCompanyCode(record: JsonRecord) {
  const nested = nestedCompany(record);
  const code =
    humanStr(nested, "code", "company_code", "companyCode", "slug") ||
    str(record, "company_code", "companyCode", "agency_code", "agencyCode");
  return looksLikeUuid(code) ? "" : code.trim();
}

export function artistCompanyName(record: JsonRecord) {
  const nested = nestedCompany(record);
  const named =
    humanStr(
      nested,
      "name",
      "companyName",
      "company_name",
      "official_name",
      "title",
      "label"
    ) ||
    humanStr(
      record,
      "companyName",
      "company_name",
      "agencyName",
      "agency_name",
      "company",
      "agency"
    );
  if (named) return named;
  const code = artistCompanyCode(record);
  return code ? companyNameFromCode(code) : "";
}

export function artistCompany(record: JsonRecord) {
  return formatCompanyLabel(
    artistCompanyName(record),
    artistCompanyCode(record)
  );
}

export function formatCell(value: unknown) {
  if (value == null || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
