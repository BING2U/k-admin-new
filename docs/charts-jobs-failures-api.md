# Charts jobs API (finalized) and failures (proposed)

k-data-new already exposes chart snapshots:

- `GET /v1/charts?source=melon_song&period=day&chartDate=2026-09-15`
- `GET /v1/charts/{id}`
- `GET /v1/charts/{id}/entries`
- `GET /v1/charts/{id}/matches`

Admin calls **only** same-origin `/v1/...` (Vite / Docker proxy to k-data-new). It never talks to a crawler host. If jobs endpoints are not merged yet, the jobs tab shows an explicit unavailable warning and **does not fabricate rows**.

Supported sources (`source_code`): `melon_song`, `hanteo_album`.  
Supported periods: `day`, `week`, `month`, `year`.

## Constraint: Melon day is latest-only

`source_code=melon_song` + `period=day` (`job_id=melon_song_day`):

- Crawler may fetch **only the latest day**.
- History backfill is not allowed.
- Manual run **must not** offer a historical date. `POST .../run` has no body.

---

## Job identity

`job_id = {source_code}_{period}` — eight jobs:

| job_id               | source_code  | period |
| -------------------- | ------------ | ------ |
| `melon_song_day`     | melon_song   | day    |
| `melon_song_week`    | melon_song   | week   |
| `melon_song_month`   | melon_song   | month  |
| `melon_song_year`    | melon_song   | year   |
| `hanteo_album_day`   | hanteo_album | day    |
| `hanteo_album_week`  | hanteo_album | week   |
| `hanteo_album_month` | hanteo_album | month  |
| `hanteo_album_year`  | hanteo_album | year   |

Job fields:

| Field                | Notes                                              |
| -------------------- | -------------------------------------------------- |
| `enabled`            | boolean                                            |
| `last_success_at`    | ISO timestamp or null                              |
| `last_failure_at`    | ISO timestamp or null                              |
| `last_error`         | string or null                                     |
| `rate_limit_seconds` | integer; **0 = unlimited**                         |
| `last_run_status`    | `never_run` \| `running` \| `success` \| `failure` |
| `last_chart_date`    | `YYYY-MM-DD` or null                               |
| `last_entry_count`   | integer or null                                    |

---

## `GET /v1/charts/jobs`

List all scheduled jobs.

```http
GET /v1/charts/jobs
```

```json
{
  "items": [
    {
      "job_id": "melon_song_day",
      "source_code": "melon_song",
      "period": "day",
      "enabled": true,
      "last_success_at": "2026-09-16T01:00:00Z",
      "last_failure_at": null,
      "last_error": null,
      "rate_limit_seconds": 0,
      "last_run_status": "success",
      "last_chart_date": "2026-09-15",
      "last_entry_count": 100
    }
  ]
}
```

Alternate collection keys `jobs` / `data` are accepted.

---

## `GET /v1/charts/jobs/{job_id}`

Fetch one job, e.g. `GET /v1/charts/jobs/melon_song_day`.

---

## `POST /v1/charts/jobs/{job_id}/run`

Run one job once. **No request body.** Disabled job → **409**.

```http
POST /v1/charts/jobs/melon_song_day/run
```

Admin does not send `chartDate`. Melon day run is latest-day only.

---

## `PATCH /v1/charts/jobs/{job_id}`

Update `enabled` and/or `rate_limit_seconds` (`0` = unlimited).

```http
PATCH /v1/charts/jobs/hanteo_album_week
Content-Type: application/json
```

```json
{
  "enabled": false,
  "rate_limit_seconds": 45
}
```

---

## `GET /v1/charts/failures` (still proposed)

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

---

## Admin unavailable handling

For `GET /v1/charts/jobs` and `GET /v1/charts/failures`:

| HTTP status             | UI                                                       |
| ----------------------- | -------------------------------------------------------- |
| 200                     | Render returned rows only                                |
| 404, 405, 501, 502, 503 | Warning: API unavailable, empty table, page stays usable |
| Other list errors       | Same non-breaking empty table + message                  |
| POST run **409**        | Job is disabled — error toast, not “API unavailable”     |

Snapshot list/detail remain required for v0.1 and show a normal error state when they fail.

Reserve path segments `jobs` and `failures` so they are not treated as snapshot ids.
