import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CHART_JOB_CATALOG,
  CHART_PERIODS,
  CHART_SOURCES,
  MELON_DAY_CONSTRAINT,
  allowsHistoricalChartDate,
  buildManualRunBody,
  buildSnapshotQuery,
  chartJobId,
  failureRow,
  formatRateLimitSeconds,
  isMelonDay,
  jobRow,
  listLoadState,
  manualRunControls,
  mergeChartEntries,
  parseChartJobId,
  snapshotRow,
  unavailableMessage
} from "./chartDisplay.ts";

const UUID = "3f1a9c2e-7b44-4d11-9c0a-0b6d5e8a1234";

describe("chart snapshot filters", () => {
  it("supports melon_song/hanteo_album and day/week/month/year", () => {
    assert.deepEqual(
      CHART_SOURCES.map(item => item.value),
      ["melon_song", "hanteo_album"]
    );
    assert.deepEqual(
      CHART_PERIODS.map(item => item.value),
      ["day", "week", "month", "year"]
    );
  });

  it("builds GET /v1/charts query from source, period, and chart_date", () => {
    assert.deepEqual(
      buildSnapshotQuery({
        source: "melon_song",
        period: "day",
        chartDate: "2026-09-15"
      }),
      {
        source: "melon_song",
        period: "day",
        chartDate: "2026-09-15"
      }
    );
    assert.deepEqual(
      buildSnapshotQuery({ source: "", period: "", chartDate: "" }),
      {}
    );
  });
});

describe("snapshot list rendering", () => {
  it("maps snapshot time, status, and entry count", () => {
    const row = snapshotRow({
      id: "snap-1",
      source: "melon_song",
      period: "day",
      chart_date: "2026-09-15",
      captured_at: "2026-09-15T18:00:00Z",
      status: "complete",
      entry_count: 100
    });
    assert.equal(row.id, "snap-1");
    assert.equal(row.source, "melon_song");
    assert.equal(row.period, "day");
    assert.equal(row.chartDate, "2026-09-15");
    assert.equal(row.snapshotTime, "2026-09-15T18:00:00Z");
    assert.equal(row.status, "complete");
    assert.equal(row.entryCount, "100");
  });

  it("falls back across snapshot time and count aliases without inventing values", () => {
    const row = snapshotRow({
      id: "snap-2",
      snapshotAt: "2026-09-16T01:00:00Z",
      entryCount: 50
    });
    assert.equal(row.snapshotTime, "2026-09-16T01:00:00Z");
    assert.equal(row.entryCount, "50");
    const empty = snapshotRow({ id: "snap-3" });
    assert.equal(empty.snapshotTime, "—");
    assert.equal(empty.status, "—");
    assert.equal(empty.entryCount, "—");
  });
});

describe("detail entries high vs candidate", () => {
  it("keeps title and name_as_seen verbatim", () => {
    const rows = mergeChartEntries(
      [
        {
          rank: 1,
          title: "Supernova",
          name_as_seen: UUID
        }
      ],
      []
    );
    assert.equal(rows[0].rank, "1");
    assert.equal(rows[0].title, "Supernova");
    assert.equal(rows[0].nameAsSeen, UUID);
  });

  it("shows linked artist_id for high matches", () => {
    const rows = mergeChartEntries(
      [
        {
          id: "e1",
          rank: 1,
          title: "Supernova",
          name_as_seen: "aespa"
        }
      ],
      [
        {
          entry_id: "e1",
          status: "high",
          confidence: 0.99,
          artist_id: "art-1"
        }
      ]
    );
    assert.equal(rows[0].confidence, "0.99");
    assert.equal(rows[0].status, "high");
    assert.equal(rows[0].matchKind, "high");
    assert.equal(rows[0].linkedArtistId, "art-1");
    assert.equal(rows[0].candidateState, "");
  });

  it("shows candidate state otherwise, even if a possible artist_id exists", () => {
    const rows = mergeChartEntries(
      [
        {
          rank: 2,
          title: "Song",
          name_as_seen: "Unknown Act"
        }
      ],
      [
        {
          rank: 2,
          status: "candidate",
          confidence: 0.4,
          artist_id: "maybe-1"
        }
      ]
    );
    assert.equal(rows[0].matchKind, "candidate");
    assert.equal(rows[0].linkedArtistId, "");
    assert.match(rows[0].candidateState, /candidate/i);
  });

  it("reads high match fields from the entry when matches are empty", () => {
    const rows = mergeChartEntries(
      [
        {
          rank: 3,
          title: "Track",
          name_as_seen: "IU",
          match_status: "high",
          confidence: 0.95,
          artist_id: "iu-1"
        }
      ],
      []
    );
    assert.equal(rows[0].matchKind, "high");
    assert.equal(rows[0].linkedArtistId, "iu-1");
  });
});

describe("Melon day no-backfill / manual-run rule", () => {
  it("treats melon_song + day as latest-only with no historical date", () => {
    assert.equal(isMelonDay("melon_song", "day"), true);
    assert.equal(allowsHistoricalChartDate("melon_song", "day"), false);
    const controls = manualRunControls("melon_song", "day");
    assert.equal(controls.showDatePicker, false);
    assert.equal(controls.allowHistoricalDate, false);
    assert.match(controls.constraint, /Melon/);
    assert.match(MELON_DAY_CONSTRAINT, /不可回填/);
    const body = buildManualRunBody("melon_song", "day", "2026-01-01");
    assert.equal(body, undefined);
  });

  it("does not offer a historical date on POST /run for any job_id", () => {
    assert.equal(
      manualRunControls("hanteo_album", "week").showDatePicker,
      false
    );
    assert.equal(
      buildManualRunBody("hanteo_album", "week", "2026-01-01"),
      undefined
    );
    assert.equal(allowsHistoricalChartDate("hanteo_album", "week"), true);
  });
});

describe("finalized chart job_id catalog", () => {
  it("uses source_code_period ids for all 8 source × period jobs", () => {
    assert.equal(chartJobId("melon_song", "day"), "melon_song_day");
    assert.equal(chartJobId("hanteo_album", "year"), "hanteo_album_year");
    assert.equal(CHART_JOB_CATALOG.length, 8);
    assert.deepEqual(
      CHART_JOB_CATALOG.map(item => item.job_id),
      [
        "melon_song_day",
        "melon_song_week",
        "melon_song_month",
        "melon_song_year",
        "hanteo_album_day",
        "hanteo_album_week",
        "hanteo_album_month",
        "hanteo_album_year"
      ]
    );
    assert.deepEqual(parseChartJobId("hanteo_album_week"), {
      source_code: "hanteo_album",
      period: "week"
    });
  });
});

describe("jobs and failures rows plus load states", () => {
  it("maps finalized job fields including last_run_status and rate_limit_seconds", () => {
    const row = jobRow({
      job_id: "melon_song_day",
      source_code: "melon_song",
      period: "day",
      enabled: true,
      last_success_at: "2026-09-16T01:00:00Z",
      last_failure_at: null,
      last_error: null,
      rate_limit_seconds: 0,
      last_run_status: "success",
      last_chart_date: "2026-09-15",
      last_entry_count: 100
    });
    assert.equal(row.id, "melon_song_day");
    assert.equal(row.source, "melon_song");
    assert.equal(row.period, "day");
    assert.equal(row.enabled, true);
    assert.equal(row.canRun, true);
    assert.equal(row.lastSuccess, "2026-09-16T01:00:00Z");
    assert.equal(row.lastFailure, "—");
    assert.equal(row.lastError, "—");
    assert.equal(row.rateLimitSeconds, 0);
    assert.equal(row.rateLimitLabel, formatRateLimitSeconds(0));
    assert.match(row.rateLimitLabel, /不限|unlimited/i);
    assert.equal(row.lastRunStatus, "success");
    assert.equal(row.lastChartDate, "2026-09-15");
    assert.equal(row.lastEntryCount, "100");
    assert.equal(row.showDatePicker, false);
  });

  it("blocks manual run when the job is disabled or already running", () => {
    const disabled = jobRow({
      job_id: "hanteo_album_week",
      source_code: "hanteo_album",
      period: "week",
      enabled: false,
      last_run_status: "never_run",
      rate_limit_seconds: 30
    });
    assert.equal(disabled.enabled, false);
    assert.equal(disabled.canRun, false);
    assert.equal(disabled.rateLimitSeconds, 30);
    assert.equal(disabled.lastRunStatus, "never_run");
    const running = jobRow({
      job_id: "hanteo_album_month",
      source_code: "hanteo_album",
      period: "month",
      enabled: true,
      last_run_status: "running",
      rate_limit_seconds: 0
    });
    assert.equal(running.canRun, false);
  });

  it("maps failure source, period, chart_date, error, created_at", () => {
    const row = failureRow({
      source: "hanteo_album",
      period: "month",
      chart_date: "2026-08-01",
      error: "timeout",
      created_at: "2026-09-16T02:00:00Z"
    });
    assert.equal(row.source, "hanteo_album");
    assert.equal(row.period, "month");
    assert.equal(row.chartDate, "2026-08-01");
    assert.equal(row.error, "timeout");
    assert.equal(row.createdAt, "2026-09-16T02:00:00Z");
  });

  it("exposes loading, empty, error, and unavailable states", () => {
    assert.equal(listLoadState({ loading: true, items: [] }).kind, "loading");
    assert.equal(listLoadState({ loading: false, items: [] }).kind, "empty");
    assert.equal(
      listLoadState({ loading: false, items: [], error: "boom" }).kind,
      "error"
    );
    const unavailable = listLoadState({
      loading: false,
      items: [],
      unavailable: true,
      unavailableMessage: "missing"
    });
    assert.equal(unavailable.kind, "unavailable");
    assert.match(
      unavailableMessage("jobs", 404, "/v1/charts/jobs"),
      /\/v1\/charts\/jobs/
    );
    assert.match(unavailableMessage("jobs", 404, "/v1/charts/jobs"), /404/);
  });
});
