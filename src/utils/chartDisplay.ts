import { formatCell, str, type JsonRecord } from "./envelope.ts";

export const CHART_SOURCES = [
  { value: "melon_song", label: "Melon 歌曲榜" },
  { value: "hanteo_album", label: "Hanteo 专辑榜" }
] as const;

export const CHART_PERIODS = [
  { value: "day", label: "日" },
  { value: "week", label: "周" },
  { value: "month", label: "月" },
  { value: "year", label: "年" }
] as const;

export const MELON_DAY_CONSTRAINT =
  "Melon 日榜仅支持最新一日，不可回填历史；手动执行不会提供历史日期。";

export type SnapshotQuery = {
  source?: string;
  period?: string;
  chartDate?: string;
};

export type SnapshotRow = {
  id: string;
  source: string;
  period: string;
  chartDate: string;
  snapshotTime: string;
  status: string;
  entryCount: string;
};

export type EntryRow = {
  rank: string;
  title: string;
  nameAsSeen: string;
  confidence: string;
  status: string;
  matchKind: "high" | "candidate";
  linkedArtistId: string;
  candidateState: string;
};

export type ManualRunBody = {
  source: string;
  period: string;
  chartDate?: string;
};

export type ManualRunControls = {
  allowHistoricalDate: boolean;
  showDatePicker: boolean;
  runLabel: string;
  constraint: string;
};

export type JobRow = {
  id: string;
  source: string;
  period: string;
  enabled: string;
  lastSuccess: string;
  lastFailure: string;
  rateLimitStatus: string;
  allowHistoricalDate: boolean;
  showDatePicker: boolean;
  runLabel: string;
};

export type FailureRow = {
  id: string;
  source: string;
  period: string;
  chartDate: string;
  error: string;
  createdAt: string;
};

export type ListLoadState<T> =
  | { kind: "loading" }
  | { kind: "empty" }
  | { kind: "error"; message: string }
  | { kind: "unavailable"; message: string }
  | { kind: "ready"; items: T[] };

const HIGH_STATUSES = new Set([
  "high",
  "high_match",
  "matched",
  "linked",
  "auto_linked"
]);

export function isMelonDay(source: string, period: string) {
  return source === "melon_song" && period === "day";
}

export function allowsHistoricalChartDate(source: string, period: string) {
  return !isMelonDay(source, period);
}

export function manualRunControls(
  source: string,
  period: string
): ManualRunControls {
  const allowHistoricalDate = allowsHistoricalChartDate(source, period);
  return {
    allowHistoricalDate,
    showDatePicker: allowHistoricalDate,
    runLabel: isMelonDay(source, period) ? "执行一次（最新日）" : "执行一次",
    constraint: isMelonDay(source, period) ? MELON_DAY_CONSTRAINT : ""
  };
}

export function buildSnapshotQuery(filters: SnapshotQuery) {
  const params: Record<string, string> = {};
  if (filters.source) params.source = filters.source;
  if (filters.period) params.period = filters.period;
  if (filters.chartDate) params.chartDate = filters.chartDate;
  return params;
}

export function buildManualRunBody(
  source: string,
  period: string,
  chartDate?: string
): ManualRunBody {
  const body: ManualRunBody = { source, period };
  if (chartDate && allowsHistoricalChartDate(source, period)) {
    body.chartDate = chartDate;
  }
  return body;
}

export function snapshotRow(record: JsonRecord): SnapshotRow {
  return {
    id: str(record, "id", "snapshotId", "snapshot_id", "_id"),
    source: str(record, "source", "source_code", "sourceCode") || "—",
    period: str(record, "period") || "—",
    chartDate:
      str(record, "chart_date", "chartDate", "date", "chartDay") || "—",
    snapshotTime: formatCell(
      record.captured_at ??
        record.capturedAt ??
        record.snapshot_at ??
        record.snapshotAt ??
        record.fetched_at ??
        record.fetchedAt ??
        record.created_at ??
        record.createdAt
    ),
    status: formatCell(record.status ?? record.state),
    entryCount: formatCell(
      record.entry_count ??
        record.entryCount ??
        record.entries_count ??
        record.entriesCount ??
        record.count
    )
  };
}

function scalar(value: unknown) {
  if (value == null || value === "") return "";
  if (typeof value === "object") return "";
  return String(value);
}

function confidenceText(record: JsonRecord | null | undefined) {
  if (!record) return "";
  return scalar(
    record.confidence ??
      record.match_confidence ??
      record.matchConfidence ??
      record.score
  );
}

function matchStatusOf(entry: JsonRecord, match: JsonRecord | null) {
  return (
    str(match, "status", "match_status", "matchStatus", "state") ||
    str(entry, "match_status", "matchStatus", "match_state", "matchState") ||
    (HIGH_STATUSES.has(str(entry, "status").toLowerCase()) ||
    str(entry, "status").toLowerCase() === "candidate"
      ? str(entry, "status")
      : "")
  );
}

function artistIdOf(entry: JsonRecord, match: JsonRecord | null) {
  return (
    str(match, "artist_id", "artistId", "linked_artist_id", "linkedArtistId") ||
    str(entry, "artist_id", "artistId", "linked_artist_id", "linkedArtistId")
  );
}

function isHighStatus(status: string) {
  return HIGH_STATUSES.has(status.trim().toLowerCase());
}

function findMatch(entry: JsonRecord, matches: JsonRecord[]) {
  const entryId = str(entry, "id", "entry_id", "entryId");
  const rank = str(entry, "rank", "position");
  if (entryId) {
    const byId = matches.find(
      item => str(item, "entry_id", "entryId", "id") === entryId
    );
    if (byId) return byId;
  }
  if (rank) {
    const byRank = matches.find(item => str(item, "rank", "position") === rank);
    if (byRank) return byRank;
  }
  return null;
}

export function chartEntryRow(
  entry: JsonRecord,
  match: JsonRecord | null = null
): EntryRow {
  const status = matchStatusOf(entry, match);
  const high = isHighStatus(status);
  const artistId = artistIdOf(entry, match);
  const confidence = confidenceText(match) || confidenceText(entry);
  return {
    rank: str(entry, "rank", "position") || "—",
    title: str(entry, "title", "name", "song_title", "album_title") || "—",
    nameAsSeen:
      str(
        entry,
        "name_as_seen",
        "nameAsSeen",
        "artist_name_as_seen",
        "artistNameAsSeen"
      ) || "—",
    confidence: confidence || "—",
    status: status || "—",
    matchKind: high ? "high" : "candidate",
    linkedArtistId: high ? artistId : "",
    candidateState: high ? "" : status || "candidate"
  };
}

export function mergeChartEntries(
  entries: JsonRecord[],
  matches: JsonRecord[] = []
): EntryRow[] {
  return entries.map(entry => chartEntryRow(entry, findMatch(entry, matches)));
}

export function jobRow(record: JsonRecord): JobRow {
  const source = str(record, "source", "source_code", "sourceCode");
  const period = str(record, "period");
  const controls = manualRunControls(source, period);
  return {
    id:
      str(record, "id", "jobId", "job_id") ||
      (source && period ? `${source}:${period}` : ""),
    source,
    period,
    enabled: formatCell(
      record.enabled ?? record.is_enabled ?? record.isEnabled
    ),
    lastSuccess: formatCell(
      record.last_success_at ??
        record.lastSuccessAt ??
        record.last_success ??
        record.lastSuccess
    ),
    lastFailure: formatCell(
      record.last_failure_at ??
        record.lastFailureAt ??
        record.last_failure ??
        record.lastFailure
    ),
    rateLimitStatus: formatCell(
      record.rate_limit_status ??
        record.rateLimitStatus ??
        record.rate_limit ??
        record.rateLimit
    ),
    allowHistoricalDate: controls.allowHistoricalDate,
    showDatePicker: controls.showDatePicker,
    runLabel: controls.runLabel
  };
}

export function failureRow(record: JsonRecord): FailureRow {
  return {
    id: str(record, "id", "failureId", "failure_id", "_id"),
    source: str(record, "source", "source_code", "sourceCode") || "—",
    period: str(record, "period") || "—",
    chartDate: str(record, "chart_date", "chartDate", "date") || "—",
    error: formatCell(
      record.error ?? record.message ?? record.reason ?? record.detail
    ),
    createdAt: formatCell(
      record.created_at ??
        record.createdAt ??
        record.failed_at ??
        record.failedAt ??
        record.time
    )
  };
}

export function listLoadState<T>(opts: {
  loading: boolean;
  items: T[];
  error?: string;
  unavailable?: boolean;
  unavailableMessage?: string;
}): ListLoadState<T> {
  if (opts.loading) return { kind: "loading" };
  if (opts.unavailable) {
    return {
      kind: "unavailable",
      message: opts.unavailableMessage || "unavailable"
    };
  }
  if (opts.error) return { kind: "error", message: opts.error };
  if (!opts.items.length) return { kind: "empty" };
  return { kind: "ready", items: opts.items };
}

export function unavailableMessage(
  resource: "jobs" | "failures",
  httpStatus: number,
  path: string
) {
  return `${resource} API 不可用（HTTP ${httpStatus}）：${path}`;
}

export function requestErrorMessage(error: unknown, fallback: string) {
  const err = error as {
    response?: { data?: { message?: string }; status?: number };
    message?: string;
  };
  return err?.response?.data?.message || err?.message || fallback;
}
