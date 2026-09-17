import Axios, { type AxiosInstance } from "axios";
import { unwrapItem, unwrapList, type JsonRecord } from "../utils/envelope.ts";
import {
  buildSnapshotQuery,
  type SnapshotQuery
} from "../utils/chartDisplay.ts";

export type ChartsHttp = {
  get: (
    url: string,
    config?: { params?: Record<string, unknown> }
  ) => Promise<unknown>;
  post: (url: string, data?: unknown) => Promise<unknown>;
  patch: (url: string, data?: unknown) => Promise<unknown>;
};

export type SnapshotListQuery = SnapshotQuery;

export type FailureListQuery = {
  source?: string;
  period?: string;
  page?: number;
  pageSize?: number;
};

export type ChartJobPatch = {
  enabled?: boolean;
  rate_limit_seconds?: number;
};

export type OptionalListResult<T extends JsonRecord = JsonRecord> = {
  ok: boolean;
  unavailable: boolean;
  httpStatus: number;
  message: string;
  items: T[];
  total: number;
  raw?: unknown;
};

const client: AxiosInstance = Axios.create({
  baseURL: "",
  timeout: 20000,
  headers: {
    Accept: "application/json, text/plain, */*",
    "Content-Type": "application/json"
  }
});

client.interceptors.response.use(
  response => response.data,
  error => Promise.reject(error)
);

const defaultHttp: ChartsHttp = {
  get: (url, config) => client.get(url, config),
  post: (url, data) => client.post(url, data),
  patch: (url, data) => client.patch(url, data)
};

function httpStatusOf(error: unknown) {
  const err = error as { response?: { status?: number }; status?: number };
  return Number(err?.response?.status ?? err?.status ?? 0);
}

function errorMessageOf(error: unknown) {
  const err = error as {
    response?: { data?: { message?: string } };
    message?: string;
  };
  return err?.response?.data?.message || err?.message || "request failed";
}

export function isUnavailableStatus(status: number) {
  return (
    status === 404 ||
    status === 405 ||
    status === 501 ||
    status === 502 ||
    status === 503 ||
    status === 0
  );
}

export function isDisabledJobConflict(error: unknown) {
  return httpStatusOf(error) === 409;
}

function unavailableResult<T extends JsonRecord>(
  url: string,
  error: unknown
): OptionalListResult<T> {
  const httpStatus = httpStatusOf(error);
  const statusLabel = httpStatus || "unavailable";
  return {
    ok: false,
    unavailable: true,
    httpStatus,
    message: `${errorMessageOf(error)} (${statusLabel}): ${url}`,
    items: [],
    total: 0
  };
}

async function getOptionalList<T extends JsonRecord>(
  http: ChartsHttp,
  url: string,
  params?: Record<string, unknown>
): Promise<OptionalListResult<T>> {
  try {
    const payload = await http.get(url, params ? { params } : undefined);
    const list = unwrapList<T>(payload);
    return {
      ok: true,
      unavailable: false,
      httpStatus: 200,
      message: "",
      items: list.items,
      total: list.total,
      raw: list.raw
    };
  } catch (error) {
    if (isUnavailableStatus(httpStatusOf(error))) {
      return unavailableResult<T>(url, error);
    }
    return unavailableResult<T>(url, error);
  }
}

export function createChartsService(http: ChartsHttp = defaultHttp) {
  return {
    async listSnapshots(query: SnapshotListQuery = {}) {
      const payload = await http.get("/v1/charts", {
        params: buildSnapshotQuery(query)
      });
      return unwrapList<JsonRecord>(payload);
    },
    async getSnapshot(id: string) {
      const payload = await http.get(`/v1/charts/${encodeURIComponent(id)}`);
      return unwrapItem<JsonRecord>(payload, id);
    },
    async listEntries(id: string) {
      const payload = await http.get(
        `/v1/charts/${encodeURIComponent(id)}/entries`
      );
      return unwrapList<JsonRecord>(payload);
    },
    async listMatches(id: string) {
      const payload = await http.get(
        `/v1/charts/${encodeURIComponent(id)}/matches`
      );
      return unwrapList<JsonRecord>(payload);
    },
    listJobs() {
      return getOptionalList(http, "/v1/charts/jobs");
    },
    async getJob(jobId: string) {
      const payload = await http.get(
        `/v1/charts/jobs/${encodeURIComponent(jobId)}`
      );
      return unwrapItem<JsonRecord>(payload, jobId);
    },
    runJob(jobId: string) {
      return http.post(`/v1/charts/jobs/${encodeURIComponent(jobId)}/run`);
    },
    async patchJob(jobId: string, body: ChartJobPatch) {
      const payload = await http.patch(
        `/v1/charts/jobs/${encodeURIComponent(jobId)}`,
        body
      );
      return unwrapItem<JsonRecord>(payload, jobId);
    },
    listFailures(query: FailureListQuery = {}) {
      const params: Record<string, unknown> = {};
      if (query.source) params.source = query.source;
      if (query.period) params.period = query.period;
      if (query.page) params.page = query.page;
      if (query.pageSize) {
        params.pageSize = query.pageSize;
        params.limit = query.pageSize;
      }
      return getOptionalList(
        http,
        "/v1/charts/failures",
        Object.keys(params).length ? params : undefined
      );
    }
  };
}

export const chartsApi = createChartsService();
