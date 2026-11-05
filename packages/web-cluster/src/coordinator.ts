import { COORD_PORT, PG_URL, QUEUE, REDIS_URL, SCHEMA } from "./common.ts";

const sql = new Bun.SQL(PG_URL);
await sql.unsafe(SCHEMA);
const redis = new Bun.RedisClient(REDIS_URL);
const observers = new Set<any>(),
  workers = new Set<any>();
const send = (set: Set<any>, msg: unknown) => {
  const s = JSON.stringify(msg);
  for (const w of set) w.send(s);
};

async function status() {
  const rows =
    await sql`SELECT status, count(*)::int AS n FROM crawl_jobs GROUP BY status`;
  const queued = Number(await redis.send("LLEN", [QUEUE]));
  return {
    queued,
    workers: workers.size,
    observers: observers.size,
    jobs: Object.fromEntries(rows.map((r: any) => [r.status, r.n])),
  };
}

const server = Bun.serve<{ role: string }>({
  hostname: process.env.YOLO_COORD_HOST ?? "127.0.0.1",
  port: COORD_PORT,
  async fetch(req, srv) {
    const u = new URL(req.url);
    if (u.pathname === "/ws")
      return srv.upgrade(req, {
        data: { role: u.searchParams.get("role") ?? "observer" },
      })
        ? undefined
        : new Response("upgrade failed", { status: 400 });
    if (u.pathname === "/status") return Response.json(await status());
    if (u.pathname === "/enqueue" && req.method === "POST") {
      const { urls, mode = "fetch" } = (await req.json()) as {
        urls: string[];
        mode?: string;
      };
      const ids: number[] = [];
      for (const url of urls) {
        const [row] =
          await sql`INSERT INTO crawl_jobs (url, mode) VALUES (${url}, ${mode}) RETURNING id`;
        await redis.send("LPUSH", [
          QUEUE,
          JSON.stringify({ id: Number(row.id), url, mode }),
        ]);
        ids.push(Number(row.id));
      }
      return Response.json({ enqueued: ids });
    }
    if (u.pathname === "/results") {
      const rows =
        await sql`SELECT j.id, j.url, j.mode, j.status, j.worker, r.http_status, r.title, r.elapsed_ms FROM crawl_jobs j LEFT JOIN crawl_results r ON r.job_id = j.id ORDER BY j.id`;
      return Response.json(rows);
    }
    return new Response("yolo-web cluster coordinator", { status: 200 });
  },
  websocket: {
    open(ws) {
      (ws.data as any).role === "worker" ? workers.add(ws) : observers.add(ws);
      ws.send(JSON.stringify({ type: "hello", role: (ws.data as any).role }));
    },
    close(ws) {
      workers.delete(ws);
      observers.delete(ws);
    },
    message(ws, raw) {
      const m = JSON.parse(String(raw));
      if (m.type === "progress") send(observers, m);
      else if (m.type === "control")
        send(workers, m); // {type:"control", cmd:"pause"|"resume"}
      else if (m.type === "status")
        status().then((s) => ws.send(JSON.stringify({ type: "status", ...s })));
    },
  },
});
console.error(`coordinator listening on ${server.hostname}:${server.port}`);
