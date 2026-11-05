import { crawl } from "../../web-crawler/src/index.ts";
import {
  COORD_WS,
  PG_URL,
  QUEUE,
  REDIS_URL,
  type Job,
  type Progress,
} from "./common.ts";
import { cdpRecon } from "./cdp.ts";

const name =
  process.env.YOLO_WORKER ??
  `${(await import("node:os")).hostname()}-${process.pid}`;
const delayMs = Number(process.env.YOLO_DELAY_MS ?? 1500);
const cdp = process.env.YOLO_CDP_ENDPOINT ?? "http://127.0.0.1:9222";
const UA = "YoloWebCluster/0.1 (+https://github.com/yolo-rs)";
const sql = new Bun.SQL(PG_URL);
const redis = new Bun.RedisClient(REDIS_URL);
const popper = new Bun.RedisClient(REDIS_URL);
let paused = false,
  ws: WebSocket | null = null;

function connect() {
  ws = new WebSocket(`${COORD_WS}?role=worker`);
  ws.onmessage = (e) => {
    const m = JSON.parse(String(e.data));
    if (m.type === "control") paused = m.cmd === "pause";
  };
  ws.onclose = () => {
    ws = null;
    setTimeout(connect, 3000);
  };
  ws.onerror = () => ws?.close();
}
connect();
const report = (p: Omit<Progress, "type" | "worker" | "at">) => {
  try {
    ws?.send(
      JSON.stringify({
        type: "progress",
        worker: name,
        at: new Date().toISOString(),
        ...p,
      }),
    );
  } catch {}
};

async function politeWait(host: string) {
  for (;;) {
    // cluster-wide per-host spacing via Redis lock
    if (
      (await redis.send("SET", [
        `yolo:crawl:host:${host}`,
        name,
        "NX",
        "PX",
        String(delayMs),
      ])) === "OK"
    )
      return;
    await Bun.sleep(150);
  }
}

async function run(job: Job) {
  const t0 = Date.now();
  await politeWait(new URL(job.url).host);
  const result = await crawl({
    seeds: [job.url],
    maxDepth: 0,
    maxPages: 1,
    delayMs: 0,
    userAgent: UA,
    respectRobots: true,
  });
  const page = result.pages[0];
  let payload: unknown = {
    page: { ...page, text: page?.text?.slice(0, 4000) },
  };
  if (!page || page.status === 0)
    throw new Error(
      page?.error ?? "no page (robots exclusion or fetch failure)",
    );
  if (job.mode === "cdp")
    payload = { ...(payload as object), recon: await cdpRecon(cdp, job.url) };
  await sql`INSERT INTO crawl_results (job_id, worker, http_status, title, sha256, elapsed_ms, payload) VALUES (${job.id}, ${name}, ${page.status}, ${page.title}, ${page.sha256}, ${Date.now() - t0}, ${JSON.stringify(payload)}::jsonb) ON CONFLICT (job_id) DO NOTHING`;
  await sql`UPDATE crawl_jobs SET status='done', worker=${name}, finished_at=now() WHERE id=${job.id}`;
}

console.error(`worker ${name} up`);
for (;;) {
  if (paused) {
    await Bun.sleep(500);
    continue;
  }
  const r = (await popper.send("BRPOP", [QUEUE, "5"])) as
    [string, string] | null;
  if (!r) continue;
  const job = JSON.parse(r[1]) as Job;
  await sql`UPDATE crawl_jobs SET status='running', worker=${name} WHERE id=${job.id}`;
  report({ jobId: job.id, url: job.url, state: "start" });
  try {
    await run(job);
    report({ jobId: job.id, url: job.url, state: "done" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await sql`UPDATE crawl_jobs SET status='failed', worker=${name}, finished_at=now() WHERE id=${job.id}`;
    report({ jobId: job.id, url: job.url, state: "error", detail: msg });
  }
}
