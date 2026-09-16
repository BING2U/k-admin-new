import Axios, { type AxiosInstance } from "axios";
import { unwrapItem, unwrapList } from "@/utils/envelope";

export type JsonRecord = Record<string, unknown>;

const client: AxiosInstance = Axios.create({
  baseURL: (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(
    /\/$/,
    ""
  ),
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

export interface ListQuery {
  q?: string;
  company?: string;
  page?: number;
  pageSize?: number;
}

export interface ListResult<T> {
  items: T[];
  total: number;
  raw: unknown;
}

export function getSources() {
  return client.get("/v1/sources").then(payload => unwrapList<JsonRecord>(payload));
}

export function getArtists(query: ListQuery = {}) {
  const params: JsonRecord = {};
  if (query.q) params.q = query.q;
  if (query.company) params.company = query.company;
  if (query.page) params.page = query.page;
  if (query.pageSize) {
    params.pageSize = query.pageSize;
    params.limit = query.pageSize;
    params.size = query.pageSize;
  }
  return client
    .get("/v1/artists", { params })
    .then(payload => unwrapList<JsonRecord>(payload));
}

export function getArtist(id: string | number) {
  return client
    .get(`/v1/artists/${encodeURIComponent(String(id))}`)
    .then(payload => unwrapItem<JsonRecord>(payload, String(id)));
}

export interface PatchArtistBody extends JsonRecord {
  mergeIntoId?: string | number;
}

export function patchArtist(id: string | number, body: PatchArtistBody) {
  return client
    .patch(`/v1/artists/${encodeURIComponent(String(id))}`, body)
    .then(payload => unwrapItem<JsonRecord>(payload, String(id)));
}

export function getIngestFailures(query: ListQuery = {}) {
  const params: JsonRecord = {};
  if (query.q) params.q = query.q;
  if (query.page) params.page = query.page;
  if (query.pageSize) {
    params.pageSize = query.pageSize;
    params.limit = query.pageSize;
  }
  return client
    .get("/v1/ingest/failures", { params })
    .then(payload => unwrapList<JsonRecord>(payload));
}

export { client as kdataHttp };
