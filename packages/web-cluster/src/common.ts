export const QUEUE = "yolo:crawl:queue";
export const REDIS_URL = process.env.YOLO_REDIS_URL ?? "redis://127.0.0.1:6379";
export const PG_URL = process.env.YOLO_PG_URL ?? "";
export const COORD_WS = process.env.YOLO_COORD_WS ?? "ws://127.0.0.1:18800/ws";
export const COORD_PORT = Number(process.env.YOLO_COORD_PORT ?? 18800);

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS crawl_jobs (
  id bigserial PRIMARY KEY,
  url text NOT NULL,
  mode text NOT NULL DEFAULT 'fetch',
  status text NOT NULL DEFAULT 'queued',
  worker text,
  enqueued_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE TABLE IF NOT EXISTS crawl_results (
  job_id bigint PRIMARY KEY REFERENCES crawl_jobs(id),
  worker text NOT NULL,
  http_status int,
  title text,
  sha256 text,
  elapsed_ms int,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);`;

export type Job = { id: number; url: string; mode: "fetch" | "cdp" };
export type Progress = { type: "progress"; worker: string; jobId: number; url: string; state: "start" | "done" | "error"; detail?: string; at: string };
