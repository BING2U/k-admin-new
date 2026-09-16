import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createChartsService,
  isDisabledJobConflict,
  type ChartsHttp
} from "./charts.ts";

function httpError(status: number, message = "Not Found") {
  const error = new Error(message) as Error & {
    response?: { status: number; data: { message: string } };
  };
  error.response = { status, data: { message } };
  return error;
}

function fakeHttp(handlers: {
  get?: ChartsHttp["get"];
  post?: ChartsHttp["post"];
  patch?: ChartsHttp["patch"];
}): ChartsHttp {
  return {
    get:
      handlers.get ??
      (async url => {
        throw new Error(`unexpected GET ${url}`);
      }),
    post:
      handlers.post ??
      (async url => {
        throw new Error(`unexpected POST ${url}`);
      }),
    patch:
      handlers.patch ??
      (async url => {
        throw new Error(`unexpected PATCH ${url}`);
      })
  };
}

describe("charts snapshot service", () => {
  it("lists snapshots via same-origin GET /v1/charts with filters", async () => {
    let called: { url?: string; params?: Record<string, unknown> } = {};
    const service = createChartsService(
      fakeHttp({
        get: async (url, config) => {
          called = { url, params: config?.params };
          return {
            items: [
              {
                id: "snap-1",
                source: "melon_song",
                period: "day",
                chart_date: "2026-09-15",
                status: "complete",
                entry_count: 10
              }
            ]
          };
        }
      })
    );
    const result = await service.listSnapshots({
      source: "melon_song",
      period: "day",
      chartDate: "2026-09-15"
    });
    assert.equal(called.url, "/v1/charts");
    assert.deepEqual(called.params, {
      source: "melon_song",
      period: "day",
      chartDate: "2026-09-15"
    });
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].id, "snap-1");
  });

  it("loads snapshot, entries, and matches by id", async () => {
    const service = createChartsService(
      fakeHttp({
        get: async url => {
          if (url === "/v1/charts/snap-1") {
            return { id: "snap-1", status: "complete" };
          }
          if (url === "/v1/charts/snap-1/entries") {
            return { entries: [{ rank: 1, title: "A", name_as_seen: "B" }] };
          }
          if (url === "/v1/charts/snap-1/matches") {
            return {
              matches: [{ rank: 1, status: "high", artist_id: "art-1" }]
            };
          }
          throw new Error(`unexpected ${url}`);
        }
      })
    );
    const snapshot = await service.getSnapshot("snap-1");
    const entries = await service.listEntries("snap-1");
    const matches = await service.listMatches("snap-1");
    assert.equal(snapshot.id, "snap-1");
    assert.equal(entries.items[0].title, "A");
    assert.equal(matches.items[0].artist_id, "art-1");
  });
});

describe("unavailable jobs and failures APIs", () => {
  it("returns an explicit unavailable result for GET /v1/charts/jobs 404", async () => {
    const service = createChartsService(
      fakeHttp({
        get: async url => {
          assert.equal(url, "/v1/charts/jobs");
          throw httpError(404);
        }
      })
    );
    const result = await service.listJobs();
    assert.equal(result.ok, false);
    assert.equal(result.unavailable, true);
    assert.equal(result.httpStatus, 404);
    assert.equal(result.items.length, 0);
    assert.match(result.message, /\/v1\/charts\/jobs/);
  });

  it("does not fabricate job rows when the jobs API is unavailable", async () => {
    const service = createChartsService(
      fakeHttp({
        get: async () => {
          throw httpError(501, "Not Implemented");
        }
      })
    );
    const result = await service.listJobs();
    assert.equal(result.items.length, 0);
    assert.equal(result.total, 0);
    assert.equal(result.unavailable, true);
  });

  it("returns live job rows when GET /v1/charts/jobs succeeds", async () => {
    const service = createChartsService(
      fakeHttp({
        get: async url => {
          assert.equal(url, "/v1/charts/jobs");
          return {
            jobs: [
              {
                job_id: "hanteo_album_week",
                source_code: "hanteo_album",
                period: "week",
                enabled: true,
                last_success_at: "2026-09-16T01:00:00Z",
                last_run_status: "success",
                rate_limit_seconds: 0
              }
            ]
          };
        }
      })
    );
    const result = await service.listJobs();
    assert.equal(result.ok, true);
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].job_id, "hanteo_album_week");
    assert.equal(result.items[0].source_code, "hanteo_album");
  });

  it("returns an explicit unavailable result for GET /v1/charts/failures 404", async () => {
    const service = createChartsService(
      fakeHttp({
        get: async url => {
          assert.equal(url, "/v1/charts/failures");
          throw httpError(404);
        }
      })
    );
    const result = await service.listFailures();
    assert.equal(result.ok, false);
    assert.equal(result.unavailable, true);
    assert.equal(result.items.length, 0);
    assert.match(result.message, /\/v1\/charts\/failures/);
  });

  it("does not fabricate failure rows when the failures API is unavailable", async () => {
    const service = createChartsService(
      fakeHttp({
        get: async () => {
          throw httpError(404);
        }
      })
    );
    const result = await service.listFailures({ page: 1, pageSize: 20 });
    assert.deepEqual(result.items, []);
  });
});

describe("finalized chart jobs contract", () => {
  it("loads one job from GET /v1/charts/jobs/{job_id}", async () => {
    const service = createChartsService(
      fakeHttp({
        get: async url => {
          assert.equal(url, "/v1/charts/jobs/melon_song_day");
          return {
            job_id: "melon_song_day",
            source_code: "melon_song",
            period: "day",
            enabled: true,
            last_run_status: "never_run",
            rate_limit_seconds: 0
          };
        }
      })
    );
    const job = await service.getJob("melon_song_day");
    assert.equal(job.job_id, "melon_song_day");
    assert.equal(job.enabled, true);
  });

  it("posts manual run to /v1/charts/jobs/{job_id}/run with no body", async () => {
    let called: { url?: string; data?: unknown } = {};
    const service = createChartsService(
      fakeHttp({
        post: async (url, data) => {
          called = { url, data };
          return { accepted: true };
        }
      })
    );
    await service.runJob("melon_song_day");
    assert.equal(called.url, "/v1/charts/jobs/melon_song_day/run");
    assert.equal(called.data, undefined);
  });

  it("treats POST run 409 as a disabled-job conflict, not unavailable", async () => {
    const service = createChartsService(
      fakeHttp({
        post: async () => {
          throw httpError(409, "job disabled");
        }
      })
    );
    await assert.rejects(
      () => service.runJob("hanteo_album_week"),
      (error: unknown) => {
        assert.equal(isDisabledJobConflict(error), true);
        return true;
      }
    );
  });

  it("patches enabled and rate_limit_seconds on /v1/charts/jobs/{job_id}", async () => {
    let called: { url?: string; data?: unknown } = {};
    const service = createChartsService(
      fakeHttp({
        patch: async (url, data) => {
          called = { url, data };
          return {
            job_id: "hanteo_album_week",
            enabled: false,
            rate_limit_seconds: 45
          };
        }
      })
    );
    const updated = await service.patchJob("hanteo_album_week", {
      enabled: false,
      rate_limit_seconds: 45
    });
    assert.equal(called.url, "/v1/charts/jobs/hanteo_album_week");
    assert.deepEqual(called.data, { enabled: false, rate_limit_seconds: 45 });
    assert.equal(updated.enabled, false);
    assert.equal(updated.rate_limit_seconds, 45);
  });
});
