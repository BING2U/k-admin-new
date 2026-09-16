import {
  artistCompany,
  artistName,
  asRecord,
  humanStr,
  str,
  type JsonRecord
} from "./envelope.ts";
import { officialHttpUrl } from "./provenance.ts";

export type BasicField = { key: string; label: string; value: string };
export type AliasRow = { lang: string; name: string };
export type MembershipRow = {
  target: string;
  role: string;
  position: string;
  join_date: string;
  leave_date: string;
  status: string;
};
export type ExternalAccountRow = {
  platform: string;
  handle: string;
  url: string;
  href: string;
};
export type SourceRow = {
  source_type: string;
  source_url: string;
  fetched_at: string;
  href: string;
};

export function artistTitle(record: JsonRecord) {
  return artistName(record);
}

export function companyLabel(record: JsonRecord) {
  return artistCompany(record);
}

export function artistTypeLabel(record: JsonRecord) {
  const raw = str(record, "type", "artist_type", "artistType").trim();
  if (!raw) return "";
  const key = raw.toLowerCase();
  if (["person", "solo", "individual", "个人", "個人"].includes(key)) {
    return "个人";
  }
  if (["group", "band", "단체", "团体", "團體"].includes(key)) {
    return "团体";
  }
  return raw;
}

export function dash(value: unknown) {
  if (value == null || value === "") return "—";
  const text = String(value).trim();
  return text || "—";
}

export function basicInfoFields(record: JsonRecord): BasicField[] {
  return [
    { key: "status", label: "状态", value: dash(str(record, "status")) },
    {
      key: "birthday",
      label: "生日",
      value: dash(str(record, "birthday", "birth_date", "birthDate"))
    },
    {
      key: "height_cm",
      label: "身高 (cm)",
      value: dash(str(record, "height_cm", "heightCm", "height"))
    },
    {
      key: "debut_date",
      label: "出道日期",
      value: dash(str(record, "debut_date", "debutDate"))
    },
    {
      key: "bio",
      label: "简介",
      value: dash(str(record, "bio", "biography", "intro"))
    },
    {
      key: "updated_at",
      label: "更新时间",
      value: dash(str(record, "updated_at", "updatedAt", "modifiedAt", "mtime"))
    }
  ];
}

function asItemList(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  const rec = asRecord(value);
  if (!rec) return [];
  for (const key of ["items", "list", "records", "rows"]) {
    if (Array.isArray(rec[key])) return rec[key] as unknown[];
  }
  const entries = Object.entries(rec);
  if (
    entries.length &&
    entries.every(
      ([, item]) => typeof item === "string" || typeof item === "number"
    )
  ) {
    return entries.map(([lang, name]) => ({ lang, name }));
  }
  return [];
}

function itemRecord(item: unknown): JsonRecord {
  if (typeof item === "string" || typeof item === "number") {
    return { name: String(item) };
  }
  return asRecord(item) ?? {};
}

export function aliasRows(record: JsonRecord): AliasRow[] {
  const list = asItemList(
    record.aliases ??
      record.alias ??
      record.nameAliases ??
      record.official_names
  );
  return list
    .map(item => {
      const row = itemRecord(item);
      return {
        lang: str(row, "lang", "locale", "language", "lang_code"),
        name:
          humanStr(row, "name", "text", "value", "alias", "official_name") ||
          (typeof item === "string" ? item : "")
      };
    })
    .filter(row => row.name);
}

export function aliasSummary(record: JsonRecord) {
  const rows = aliasRows(record);
  if (!rows.length) return "";
  return rows
    .map(row => (row.lang ? `${row.lang}: ${row.name}` : row.name))
    .join(" · ");
}

function namesEqual(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function membershipGroupName(row: JsonRecord) {
  const group = asRecord(row.group) ?? asRecord(row.group_artist);
  return (
    humanStr(group, "official_name", "officialName", "name", "display_name") ||
    humanStr(
      row,
      "group_name",
      "groupName",
      "group_official_name",
      "groupOfficialName"
    )
  );
}

function membershipMemberName(row: JsonRecord) {
  const member = asRecord(row.member) ?? asRecord(row.artist);
  return (
    humanStr(
      member,
      "official_name",
      "officialName",
      "name",
      "display_name",
      "displayName"
    ) ||
    humanStr(
      row,
      "member_name",
      "memberName",
      "member_official_name",
      "memberOfficialName"
    )
  );
}

function membershipTargetName(row: JsonRecord, record: JsonRecord) {
  const groupName = membershipGroupName(row);
  const memberName = membershipMemberName(row);
  const currentName = artistName(record);
  const type = artistTypeLabel(record);
  const fallback =
    humanStr(row, "official_name", "name", "target") ||
    groupName ||
    memberName;

  if (type === "团体") return memberName || fallback;
  if (type === "个人") return groupName || fallback;
  if (currentName && groupName && namesEqual(currentName, groupName)) {
    return memberName || fallback;
  }
  if (currentName && memberName && namesEqual(currentName, memberName)) {
    return groupName || fallback;
  }
  return groupName || memberName || fallback;
}

export function membershipRows(record: JsonRecord): MembershipRow[] {
  const list = asItemList(
    record.memberships ?? record.membership ?? record.groups ?? record.members
  );
  return list
    .map(item => {
      const row = itemRecord(item);
      return {
        target: membershipTargetName(row, record),
        role: str(row, "role", "member_role", "memberRole"),
        position: str(row, "position", "positions"),
        join_date: str(row, "join_date", "joinDate", "start_date", "startDate"),
        leave_date: str(row, "leave_date", "leaveDate", "end_date", "endDate"),
        status: str(row, "status")
      };
    })
    .filter(row => row.target || row.role);
}

export function externalAccountRows(record: JsonRecord): ExternalAccountRow[] {
  const list = asItemList(
    record.external_accounts ??
      record.externalAccounts ??
      record.social_accounts ??
      record.socialAccounts ??
      record.socials ??
      record.accounts ??
      record.sns
  );
  return list
    .map(item => {
      const row = itemRecord(item);
      const url = str(row, "url", "link", "href", "profile_url", "profileUrl");
      return {
        platform: str(row, "platform", "provider", "type", "network"),
        handle: str(row, "handle", "username", "account", "uid"),
        url,
        href: officialHttpUrl(url)
      };
    })
    .filter(row => row.platform || row.handle || row.url);
}

export function sourceRows(record: JsonRecord): SourceRow[] {
  const list = asItemList(record.sources ?? record.provenance);
  const rows = list
    .map(item => {
      const row = itemRecord(item);
      const url = str(row, "source_url", "sourceUrl", "url");
      return {
        source_type: str(row, "source_type", "sourceType", "type", "kind"),
        source_url: url,
        fetched_at: str(row, "fetched_at", "fetchedAt", "fetched"),
        href: officialHttpUrl(url)
      };
    })
    .filter(row => row.source_type || row.source_url || row.fetched_at);

  if (rows.length) return rows;

  const url = str(record, "source_url", "sourceUrl", "source");
  const fetched = str(record, "fetched_at", "fetchedAt", "fetched");
  const sourceType = str(record, "source_type", "sourceType");
  if (url || fetched || sourceType) {
    return [
      {
        source_type: sourceType,
        source_url: url,
        fetched_at: fetched,
        href: officialHttpUrl(url)
      }
    ];
  }
  return [];
}

export function prettyJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2) ?? "";
  } catch {
    return String(value);
  }
}

export function companyFormValue(record: JsonRecord) {
  const named = humanStr(
    record,
    "company",
    "companyName",
    "company_name",
    "agency",
    "agencyName",
    "agency_name"
  );
  if (named) return named;
  return str(record, "company_code", "companyCode");
}
