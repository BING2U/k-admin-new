# Charts jobs and failures API (proposed)

k-data-new already exposes chart snapshots:

- `GET /v1/charts?source=melon_song&period=day&chartDate=2026-09-15`
- `GET /v1/charts/{id}`
- `GET /v1/charts/{id}/entries`
- `GET /v1/charts/{id}/matches`

Admin Charts v0.1 also needs crawler/job status. Those endpoints are **not live yet**. This admin UI calls only same-origin `/v1/...` (proxied to k-data-new). It never talks to a crawler host directly. Until the backend implements the contract below, the jobs and failures tabs show an explicit unavailable state (HTTP 404/501/…) and **do not fabricate rows**.

Supported sources: `melon_song`, `hanteo_album`.  
Supported periods: `day`, `week`, `month`, `year`.

## Constraint: Melon day is latest-only

`source=melon_song` + `period=day`:

- Crawler may fetch **only the latest day**.
- History backfill is not allowed.
- Manual run **must not** accept a historical `chartDate`. Admin omits `chartDate` for this pair even if a date is present in the UI.

Other source/period pairs may send `chartDate` on a manual run.

---

## `GET /v1/charts/jobs`

List scheduled crawl/ingest jobs, one row per `source` + `period`.

```http
GET /v1/charts/jobs
```

```json
{
  "items": [
    {
      "id": "melon_song:day",
      "source": "melon_song",
      "period": "day",
      "enabled": true,
      "last_success_at": "2026-09-16T01:00:00Z",
      "last_failure_at": null,
      "last_error": null,
      "rate_limit_status": "ok",
      "rate_limit_remaining": 12,
      "rate_limit_reset_at": null
    }
  ]
}
```

Alternate collection keys `jobs` / `data` are accepted. Field aliases (`lastSuccessAt`, `rateLimitStatus`, …) are accepted.

`rate_limit_status` is a string such as `ok`, `limited`, or a crawler-specific token. Missing fields render as `—`.

Suggested `id`: `{source}:{period}`.

---

## `POST /v1/charts/jobs/run`

Run one job once. Body is JSON.

```http
POST /v1/charts/jobs/run
Content-Type: application/json
```

Melon day (no date):

```json
{
  "source": "melon_song",
  "period": "day"
}
```

Other jobs may include a historical date:

```json
{
  "source": "hanteo_album",
  "period": "week",
  "chartDate": "2026-09-01"
}
```

`202 Accepted` or `200` with a small acknowledgement object is enough. `404`/`501` is treated as unavailable (same as GET).

Optional equivalent: `POST /v1/charts/jobs/{id}/run`. Admin v0.1 uses `/v1/charts/jobs/run` with `source` + `period`.

---

## `GET /v1/charts/failures`

Chart crawl/ingest failures. **No sample/mock rows on the client.**

```http
GET /v1/charts/failures?source=melon_song&period=day&page=1&pageSize=20
```

```json
{
  "items": [
    {
      "id": "fail-1",
      "source": "melon_song",
      "period": "day",
      "chart_date": "2026-09-15",
      "error": "rate limited",
      "created_at": "2026-09-15T18:01:00Z"
    }
  ],
  "total": 1
}
```

Alternate collection key: `failures`. Query params `limit` may alias `pageSize`.

---

## Admin unavailable handling

For `GET /v1/charts/jobs` and `GET /v1/charts/failures`:

| HTTP status             | UI                                                       |
| ----------------------- | -------------------------------------------------------- |
| 200                     | Render returned rows only                                |
| 404, 405, 501, 502, 503 | Warning: API unavailable, empty table, page stays usable |
| Other errors            | Same non-breaking empty table + message                  |

Snapshot list/detail (`/v1/charts`, `/v1/charts/{id}`, `.../entries`, `.../matches`) are required for v0.1 and show a normal error state when they fail.

Reserve path segments `jobs` and `failures` so they are not treated as snapshot ids.
