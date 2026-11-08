// SPDX-License-Identifier: Apache-2.0
// 24/7 Automated Real-Time Google Ecosystem Indexer & Search Engine
// Powers SQLite WAL RAG Database, Knowledge Chunks, robots.txt, and llms.txt

import { Database } from "bun:sqlite";

export interface IndexDocument {
  id: string;
  title: string;
  url: string;
  description: string;
  category: string;
  keywords: string[];
}

export interface GcloudLearnModule {
  id: string;
  track:
    | "paris-europe-west9"
    | "gvisor-sandbox"
    | "moonshot-10x"
    | "skills-boost-cert"
    | "google-oss-gerrit"
    | "chromium-v8-webgpu"
    | "aosp-treble-microdroid";
  title: string;
  content: string;
  commandsOrApis: string[];
}

export const GCLOUD_LEARN_AND_GVISOR_MODULES: GcloudLearnModule[] = [
  {
    id: "mod-paris-01",
    track: "paris-europe-west9",
    title:
      "Google Cloud Paris Region (europe-west9) Sovereign Resilience Architecture",
    content:
      "europe-west9 in Paris guarantees low-latency zero-carbon cloud infrastructure with 3 zones. Dual-region or multi-region replication paired with Cloud Spanner and Cloud Run enables fault tolerance with zero data loss under strict European sovereign KMS policies.",
    commandsOrApis: [
      "gcloud compute networks subnets create",
      "gcloud run deploy --region europe-west9",
      "gcloud spanner instances create",
      "gcloud kms keys create",
    ],
  },
  {
    id: "mod-gvisor-02",
    track: "gvisor-sandbox",
    title:
      "gVisor Architecture: Application Kernel, Sentry Syscall Interception, Gofer and LISAFS",
    content:
      "gVisor provides defense-in-depth container isolation by intercepting untrusted Linux system calls in user space using the Go-based Sentry application kernel. Filesystem operations run in an isolated Gofer process communicating via LISAFS.",
    commandsOrApis: [
      "runsc run",
      "runsc spec",
      "docker run --runtime=runsc",
      "gcloud container clusters create --sandbox-provider=gvisor",
    ],
  },
  {
    id: "mod-10x-03",
    track: "moonshot-10x",
    title: "Google X / Alphabet 10x Moonshot Engineering Rubric",
    content:
      "A 10x improvement is often easier to achieve than a 10% improvement because it forces engineering teams to completely discard obsolete assumptions and build radical solutions from first principles using minimal latency and maximum scalability.",
    commandsOrApis: [
      "first_principles_audit()",
      "zero_cost_abstraction()",
      "sub_millisecond_slas()",
    ],
  },
  {
    id: "mod-cert-04",
    track: "skills-boost-cert",
    title:
      "Google Cloud Skills Boost & Professional Cloud Architect 2026 Curriculum",
    content:
      "Preparation journey covering the 5 Pillars of the Well-Architected Framework: Operational Excellence, Security, Reliability, Performance Efficiency, and Cost Optimization. Fully aligned with Google Cloud Innovators and Skills Boost challenge labs.",
    commandsOrApis: [
      "gcloud beta billing budgets create",
      "gcloud monitoring dashboards create",
      "gcloud logging sinks create",
    ],
  },
  {
    id: "mod-oss-05",
    track: "google-oss-gerrit",
    title:
      "Google Open Source Contribution Workflow (Gerrit, depot_tools, CLA & Change-Id)",
    content:
      "Official Google upstream contribution protocol using depot_tools, git cl upload, Change-Id footers, code reviews on review.googlesource.com, and automated presubmit trybots across Chromium, AOSP, and gVisor.",
    commandsOrApis: [
      "fetch chromium",
      "gclient sync",
      "git cl upload",
      "git cl try",
    ],
  },
  {
    id: "mod-chromium-06",
    track: "chromium-v8-webgpu",
    title: "Chromium Blink, V8 TurboFan & WebGPU Dawn Architecture",
    content:
      "Browser engine pipeline spanning DOM parsing, Blink style recalculation, Skia/Ganesh rasterization, V8 multi-tier JIT compiler (Ignition, Sparkplug, Maglev, TurboFan), and Dawn WebGPU hardware execution.",
    commandsOrApis: [
      "gn gen out/Release",
      "ninja -C out/Release chrome",
      "v8::Isolate::GetCurrent()",
      "navigator.gpu.requestAdapter()",
    ],
  },
  {
    id: "mod-aosp-07",
    track: "aosp-treble-microdroid",
    title: "AOSP Architecture: Project Treble, Microdroid VMs & Linux GKI",
    content:
      "Modular Android Open Source Project stack decoupling vendor hardware abstraction layers (HALs) via Treble Binder IPC, running isolated confidential workloads in Microdroid pVMs, and standardizing kernels on Linux GKI.",
    commandsOrApis: [
      "repo init -u https://android.googlesource.com/platform/manifest",
      "repo sync",
      "source build/envsetup.sh",
      "lunch aosp_x86_64-trunk_staging-userdebug",
    ],
  },
  {
    id: "mod-dream-stargardt-08",
    track: "moonshot-10x",
    title:
      "Stargardt Monocular Assistive WebGPU WGSL Shader & Google Cloud Paris Career Path",
    content:
      "From Guadeloupe without Wi-Fi (compiling Chromium OS & AOSP at 14) to Google Cloud Paris (europe-west9) and Mountain View: custom WebGPU WGSL fragment shader (#05080c OLED black, gaze magnification, warm amber halo), pure Bun YouTube DASH/HLS extractor, and 20 TB Google Drive chunked sync.",
    commandsOrApis: [
      "StargardtAssistiveShaderEngine.getWgslShader()",
      "GoogleDrive20TbSyncEngine.getStorageMetrics()",
      "YouTubeEngine.fetchVideoMetadata()",
    ],
  },
];

export class GoogleKnowledgeAndRagDb {
  public readonly db: Database;

  constructor(dbPath = ":memory:") {
    this.db = new Database(dbPath, { create: true });
    this.initSchema();
    this.seedModules();
  }

  private initSchema(): void {
    this.db.run("PRAGMA journal_mode = WAL;");
    this.db.run("PRAGMA synchronous = NORMAL;");
    this.db.run(`
      CREATE TABLE IF NOT EXISTS knowledge_chunks (
        id TEXT PRIMARY KEY,
        track TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        commands_json TEXT NOT NULL,
        embedding_json TEXT NOT NULL,
        indexed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  private seedModules(): void {
    const check = this.db
      .query("SELECT COUNT(*) as count FROM knowledge_chunks")
      .get() as { count: number };
    if (check.count >= GCLOUD_LEARN_AND_GVISOR_MODULES.length) return;

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO knowledge_chunks (id, track, title, content, commands_json, embedding_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const mod of GCLOUD_LEARN_AND_GVISOR_MODULES) {
      const embedding = this.computeEmbedding(
        `${mod.track} ${mod.title} ${mod.content}`,
      );
      stmt.run(
        mod.id,
        mod.track,
        mod.title,
        mod.content,
        JSON.stringify(mod.commandsOrApis),
        JSON.stringify(embedding),
      );
    }
  }

  computeEmbedding(text: string): number[] {
    const dim = 16;
    const vec = new Array<number>(dim).fill(0);
    const clean = text.toLowerCase();
    for (let i = 0; i < clean.length; i++) {
      const code = clean.charCodeAt(i);
      const slot = i % dim;
      vec[slot] = (vec[slot]! + code * 0.01) % 1.0;
    }
    const mag = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0)) || 1.0;
    return vec.map((v) => Number((v / mag).toFixed(6)));
  }

  cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      const va = a[i]!;
      const vb = b[i]!;
      dot += va * vb;
      normA += va * va;
      normB += vb * vb;
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
  }

  querySemanticRag(
    query: string,
    topK = 3,
  ): Array<GcloudLearnModule & { score: number }> {
    const qEmb = this.computeEmbedding(query);
    const qTokens = query
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length >= 2);
    const rows = this.db
      .query("SELECT * FROM knowledge_chunks")
      .all() as Array<{
      id: string;
      track: GcloudLearnModule["track"];
      title: string;
      content: string;
      commands_json: string;
      embedding_json: string;
    }>;

    const scored = rows.map((r) => {
      const emb = JSON.parse(r.embedding_json) as number[];
      let score = this.cosineSimilarity(qEmb, emb);
      const titleLower = r.title.toLowerCase();
      const contentLower = r.content.toLowerCase();
      const trackLower = r.track.toLowerCase();
      for (const tok of qTokens) {
        if (titleLower.includes(tok) || trackLower.includes(tok)) {
          score += 1.0;
        } else if (contentLower.includes(tok)) {
          score += 0.25;
        }
      }
      return {
        id: r.id,
        track: r.track,
        title: r.title,
        content: r.content,
        commandsOrApis: JSON.parse(r.commands_json) as string[],
        score: Number(score.toFixed(4)),
      };
    });

    return scored.sort((a, b) => b.score - a.score).slice(0, topK);
  }

  countChunks(): number {
    const row = this.db
      .query("SELECT COUNT(*) as cnt FROM knowledge_chunks")
      .get() as { cnt: number };
    return row.cnt;
  }
}

export class GoogleIndexerEngine {
  public readonly ragDb: GoogleKnowledgeAndRagDb;
  private readonly defaultDocs: IndexDocument[] = [
    {
      id: "doc-google-bun",
      title: "Google Bun: Sovereign Google Infrastructure Runtime",
      url: "https://aphrody.com/google-bun",
      description:
        "Chromium, AOSP, GCP and Gemini deep-stack tooling on Upstream Bun.",
      category: "infrastructure",
      keywords: ["google", "bun", "chromium", "aosp", "runtime"],
    },
    {
      id: "doc-gcloud-learn",
      title: "Google Cloud Learn: Europe-West9 Paris & Certifications",
      url: "https://gcloud-learn.aphrody.com",
      description:
        "Interactive learning platform for Google Cloud Paris, ACE, PCA and PDE.",
      category: "education",
      keywords: ["gcloud", "paris", "europe-west9", "certifications"],
    },
  ];

  constructor(dbPath?: string) {
    this.ragDb = new GoogleKnowledgeAndRagDb(dbPath);
  }

  search(query: string): IndexDocument[] {
    const qLower = query.toLowerCase();
    return this.defaultDocs.filter(
      (d) =>
        d.title.toLowerCase().includes(qLower) ||
        d.description.toLowerCase().includes(qLower) ||
        d.keywords.some((k) => k.includes(qLower)),
    );
  }

  generateRobotsTxt(): string {
    return `# Google Ecosystem Robots.txt — Sovereign & 100% Unrestricted for Googlebot & AI Crawlers
User-agent: Googlebot
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: GoogleOther
Allow: /

User-agent: *
Allow: /

Sitemap: https://aphrody.com/sitemap.xml
Sitemap: https://gcloud-learn.aphrody.com/sitemap.xml
`;
  }

  generateLlmsTxt(): string {
    return `# Google Bun: Sovereign Google Infrastructure Runtime
> Standard: 100% Upstream Bun v1.4.4+, Pure TypeScript, Serverless SQLite WAL, WebGPU Dawn & Chromium AOSP.

## Modules
- Google Cloud Paris: europe-west9, sovereign resilience, Cloud Spanner & Cloud Run.
- gVisor Sandbox: Sentry application kernel syscall virtualization & Gofer LISAFS.
- Larry Page 10x Moonshot: First-principles engineering rubric.
- Chromium & V8: WebGPU Dawn, TurboFan JIT compiler and Blink raster layers.
- AOSP: Project Treble, Microdroid lightweight VMs & Linux GKI.
- Chromium Third-Party Management: Upstream DEPS, cipd, GN, Ninja and WebKit synchronizations.
- Compiler & Sandbox Benchmark Suite: TS7, Bun AoT, Oxc, tsrs, Vercel Native, Deno and gVisor isolation.
`;
  }
}

export const indexer = new GoogleIndexerEngine();
export default indexer;
