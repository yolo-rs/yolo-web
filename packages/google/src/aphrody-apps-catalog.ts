// SPDX-License-Identifier: Apache-2.0
/**
 * Aphrody.app (*.aphrody.app) Top-1 Rust/Bun/WebGPU/Bevy/60GB-CPK Ecosystem Catalog,
 * Reproducible Crawler (bun:sqlite WAL + FTS5 + Bun.redis), and Auto-Generator for
 * Subdomain Portals, Dynamic SVG OpenGraph, Phosphor SVG Icons, Sitemap, and Bevy 60GB CPK AI Builder.
 */

import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

export type AphrodyTop1DomainCategory =
  | "code_editor"
  | "terminal"
  | "shell"
  | "local_ai"
  | "file_manager"
  | "desktop_env"
  | "game_engine"
  | "game_devtools"
  | "game_showcase"
  | "ui_framework"
  | "gpu_graphics"
  | "web_fullstack"
  | "layout_engine"
  | "ecosystem_index"
  | "interactive_showcase"
  | "monorepo_templates"
  | "engineering_docs";

export interface AphrodyTop1AppSpec {
  readonly id: string;
  readonly subdomain: string;
  readonly fqdn: string;
  readonly url: string;
  readonly pathAlias: string;
  readonly title: string;
  readonly rankLabel: string;
  readonly category: AphrodyTop1DomainCategory;
  readonly upstreamRepo: string;
  readonly license: string;
  readonly primaryStack: string;
  readonly gpuBackend: "wgpu-24-webgpu-vulkan" | "gpui-wgpu-sdf" | "sugarloaf-wgpu" | "llama-cpp-webgpu";
  readonly wasmTarget: "wasm32-unknown-unknown" | "wasm32-wasip2" | "hybrid-native-wasm";
  readonly accentHex: "#FFD700" | "#7C5CFF" | "#00D4FF" | "#4285F4" | "#17335C";
  readonly phosphorIcon: string;
  readonly phosphorSvgPath: string;
  readonly summaryEn: string;
  readonly summaryFr: string;
  readonly sharedWorkspaceCrates: readonly string[];
  readonly bunPackages: readonly string[];
  readonly cliLaunchCmd: string;
  readonly dockerHeadlessCmd: string;
  readonly webgpuShaderWgsl: string;
  readonly apiEndpoints: readonly string[];
  readonly starsEstimate: number;
}

export interface SharedMonorepoSpec {
  readonly workspaceName: "aphrody-yolo-shared-monorepo";
  readonly rustEdition: "2024";
  readonly rustToolchain: "1.95.0";
  readonly bunVersion: "1.4.4+";
  readonly sharedCargoTargetDir: string;
  readonly sharedGpuBackend: {
    readonly crate: "wgpu";
    readonly version: "24.0.1";
    readonly nativeBackends: readonly ["Vulkan", "Metal", "DX12", "GLES3"];
    readonly browserBackend: "WebGPU + Dawn + WebGL2 fallback";
    readonly shaderPipeline: "Naga WGSL + SPIR-V + MSL + HLSL";
  };
  readonly workspaceDependencies: Record<string, string>;
  readonly packageJsonWorkspaces: readonly string[];
}

export interface Bevy60GbCpkBlueprint {
  readonly id: "bevy-cpk-60gb-ai-builder";
  readonly engine: "Bevy 0.16+ Fullstack WebGPU & Headless Vulkan";
  readonly archiveFormat: "CRIWARE CPK (yolo-re ie_cpk_pack / ie_cpk_extract / 60GB streaming)";
  readonly maxArchiveBytes: number;
  readonly maxArchiveLabel: "60 GB (64,424,509,440 bytes)";
  readonly chunkSizeMb: 64;
  readonly compressionCodec: "CRILAYLA + Zstd + LZ4 streaming blocks";
  readonly headlessDockerImage: "ghcr.io/aphrody-labs/bevy-cpk-headless:2026.11";
  readonly vpsNodes: readonly [
    { readonly node: "vps1-paris"; readonly role: "Headless Vulkan Render + CPK Baker"; readonly host: "vps1.aphrody.com" },
    { readonly node: "vps2-frankfurt"; readonly role: "AI Agent Procedural ECS/WGSL Generator"; readonly host: "vps2.aphrody.com" },
    { readonly node: "vps3-tokyo"; readonly role: "60GB CPK Edge CDN + HTTP Range Streamer"; readonly host: "vps3.aphrody.com" },
  ];
  readonly aiPipelineStages: readonly {
    readonly stage: number;
    readonly name: string;
    readonly tool: string;
    readonly description: string;
  }[];
  readonly ecsManifestSample: {
    readonly sceneName: string;
    readonly entities: number;
    readonly wgslShaders: readonly string[];
    readonly cpkMounts: readonly string[];
  };
  readonly sampleWgslPbrShader: string;
}

export interface CrawlerSyncReceipt {
  readonly runId: string;
  readonly timestampIso: string;
  readonly sqlitePath: string;
  readonly sqliteWalEnabled: boolean;
  readonly fts5IndexedCount: number;
  readonly totalAppsSynced: number;
  readonly bevyPipelinesSynced: number;
  readonly redisConnected: boolean;
  readonly redisUrl: string;
  readonly redisKeysWritten: readonly string[];
}

const DEFAULT_WGSL_FRAGMENT = /* wgsl */ `
struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@group(0) @binding(0) var<uniform> u_time: f32;

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
  let uv = in.uv * 2.0 - vec2<f32>(1.0, 1.0);
  let d = length(uv);
  let wave = sin(d * 10.0 - u_time * 2.4) * 0.5 + 0.5;
  let navy = vec3<f32>(0.090, 0.200, 0.361);
  let violet = vec3<f32>(0.486, 0.361, 1.000);
  let cyan = vec3<f32>(0.000, 0.831, 1.000);
  let gold = vec3<f32>(1.000, 0.843, 0.000);
  let col = mix(mix(navy, violet, wave), mix(cyan, gold, uv.x * 0.5 + 0.5), 0.45);
  return vec4<f32>(col, 1.0);
}
`.trim();

/**
 * Complete 21-item Top-1 Rust/Bun/WebGPU/Bevy/60GB-CPK Open-Source Self-Hosted Distribution Catalog.
 */
export const APHRODY_TOP1_RUST_BUN_CATALOG: readonly AphrodyTop1AppSpec[] = [
  {
    id: "zed",
    subdomain: "zed",
    fqdn: "zed.aphrody.app",
    url: "https://zed.aphrody.app",
    pathAlias: "/app/zed",
    title: "Zed Code Editor — GPU-Accelerated Multiplayer IDE",
    rankLabel: "Top-1 Code Editor",
    category: "code_editor",
    upstreamRepo: "https://github.com/zed-industries/zed",
    license: "GPL-3.0 / Apache-2.0",
    primaryStack: "Rust + GPUI + WGPU + Tree-sitter + CRDT + LSP",
    gpuBackend: "gpui-wgpu-sdf",
    wasmTarget: "hybrid-native-wasm",
    accentHex: "#4285F4",
    phosphorIcon: "code-block",
    phosphorSvgPath: "M88,64,32,128l56,64M168,64l56,64-56,64M144,40,112,216",
    summaryEn:
      "Self-hosted Zed Code Editor compiled with shared yolo-ui GPUI analytical SDF shaders, Tree-sitter incremental parsing, CRDT collaborative buffers, and direct Aphrody Local Uncensored AI inline completion.",
    summaryFr:
      "Éditeur de code Zed auto-hébergé compilé avec les shaders SDF analytiques GPUI de yolo-ui, Tree-sitter, tampons collaboratifs CRDT et complétion IA locale Aphrody.",
    sharedWorkspaceCrates: ["yolo-gpui", "yolo-shared", "yolo-tokens", "yolo-render", "tree-sitter"],
    bunPackages: ["@yolo-web/google", "@yolo-rs/ui-plugin"],
    cliLaunchCmd: "bun run ui launch zed --gpu wgpu --ai-endpoint http://127.0.0.1:8082/v1",
    dockerHeadlessCmd: "docker run --rm --gpus all -p 8793:8793 ghcr.io/aphrody-labs/zed-webgpu:latest",
    webgpuShaderWgsl: DEFAULT_WGSL_FRAGMENT,
    apiEndpoints: ["/api/apps/zed", "/app/zed", "/og/zed.svg", "/icon/zed.svg"],
    starsEstimate: 58400,
  },
  {
    id: "rio",
    subdomain: "rio",
    fqdn: "rio.aphrody.app",
    url: "https://rio.aphrody.app",
    pathAlias: "/app/rio",
    title: "Rio Terminal — Hardware-Accelerated WebGPU Terminal",
    rankLabel: "Top-1 Terminal",
    category: "terminal",
    upstreamRepo: "https://github.com/raphamorim/rio",
    license: "MIT",
    primaryStack: "Rust + SugarLoaf Font Engine + WGPU 24 + WebSockets PTY",
    gpuBackend: "sugarloaf-wgpu",
    wasmTarget: "wasm32-unknown-unknown",
    accentHex: "#00D4FF",
    phosphorIcon: "terminal-window",
    phosphorSvgPath: "M32,48H224a8,8,0,0,1,8,8V200a8,8,0,0,1-8,8H32a8,8,0,0,1-8-8V56A8,8,0,0,1,32,48ZM72,104l32,24L72,152m56,0h48",
    summaryEn:
      "Hardware-accelerated GPU terminal powered by SugarLoaf glyph caching, WGPU 24 instanced rendering, Sixel/iTerm2 image protocols, and browser WebGPU WASM multiplexer.",
    summaryFr:
      "Terminal GPU accéléré matériellement propulsé par le moteur de glyphes SugarLoaf, le rendu instancié WGPU 24 et le multiplexeur WebGPU WASM.",
    sharedWorkspaceCrates: ["yolo-gpu", "yolo-render", "yolo-tokens", "sugarloaf"],
    bunPackages: ["@yolo-web/google"],
    cliLaunchCmd: "bun run ui launch rio --shell nushell --renderer wgpu",
    dockerHeadlessCmd: "docker run --rm --gpus all -p 8810:8810 ghcr.io/aphrody-labs/rio-webgpu:latest",
    webgpuShaderWgsl: DEFAULT_WGSL_FRAGMENT,
    apiEndpoints: ["/api/apps/rio", "/app/rio", "/og/rio.svg", "/icon/rio.svg"],
    starsEstimate: 5200,
  },
  {
    id: "nushell",
    subdomain: "nushell",
    fqdn: "nushell.aphrody.app",
    url: "https://nushell.aphrody.app",
    pathAlias: "/app/nushell",
    title: "Nushell — Structured Data Shell + Bun Bridge",
    rankLabel: "Top-1 Shell",
    category: "shell",
    upstreamRepo: "https://github.com/nushell/nushell",
    license: "MIT",
    primaryStack: "Rust + Nu-Engine + Polars DataFrames + Bun.spawn IPC",
    gpuBackend: "wgpu-24-webgpu-vulkan",
    wasmTarget: "wasm32-wasip2",
    accentHex: "#FFD700",
    phosphorIcon: "brackets-curly",
    phosphorSvgPath: "M80,40c-24,0-24,24-24,48s0,40-24,40c24,0,24,16,24,40s0,48,24,48M176,40c24,0,24,24,24,48s0,40,24,40c-24,0-24,16-24,40s0,48-24,48",
    summaryEn:
      "Structured pipelines shell treating tables, JSON, SQLite, Parquet, and CPK archives as typed streams, bridged natively with Upstream Bun v1.4.4+.",
    summaryFr:
      "Shell de pipelines structurés traitant tables, JSON, SQLite, Parquet et archives CPK comme des flux typés, interfacé avec Upstream Bun v1.4.4+.",
    sharedWorkspaceCrates: ["yolo-shared", "nu-protocol", "nu-engine"],
    bunPackages: ["@yolo-web/google"],
    cliLaunchCmd: "nu --config ~/.config/aphrody/config.nu",
    dockerHeadlessCmd: "docker run --rm -it ghcr.io/aphrody-labs/nushell-bun:latest",
    webgpuShaderWgsl: DEFAULT_WGSL_FRAGMENT,
    apiEndpoints: ["/api/apps/nushell", "/app/nushell", "/og/nushell.svg", "/icon/nushell.svg"],
    starsEstimate: 34800,
  },
  {
    id: "uncensored",
    subdomain: "uncensored",
    fqdn: "uncensored.aphrody.app",
    url: "https://uncensored.aphrody.app",
    pathAlias: "/app/uncensored",
    title: "Aphrody Local Uncensored AI — Sovereign GGUF & WebGPU Studio",
    rankLabel: "Top-1 Local Uncensored AI",
    category: "local_ai",
    upstreamRepo: "https://github.com/ggerganov/llama.cpp",
    license: "AGPL-3.0 / MIT",
    primaryStack: "Rust + llama.cpp + Qwen 2.5/3 (:8081/:8082/:8084/:8090) + WebGPU WGSL",
    gpuBackend: "llama-cpp-webgpu",
    wasmTarget: "hybrid-native-wasm",
    accentHex: "#7C5CFF",
    phosphorIcon: "brain",
    phosphorSvgPath: "M128,48v160M88,48a40,40,0,0,0-40,40v64a40,40,0,0,0,40,40h80a40,40,0,0,0,40-40V88a40,40,0,0,0-40-40Z",
    summaryEn:
      "Zero-censorship sovereign AI inference cluster: llama.cpp Qwen 2.5/3 Chat (:8081), Coder (:8082/:8084), Embeddings (:8090), and in-browser WebGPU WGSL quantized matrix kernels.",
    summaryFr:
      "Cluster d'inférence IA souverain sans censure : llama.cpp Qwen 2.5/3 Chat (:8081), Coder (:8082/:8084), Embeddings (:8090) et noyaux matriciels WebGPU WGSL.",
    sharedWorkspaceCrates: ["locally-uncensored", "yolo-gpu", "yolo-shared", "yolo-tauri"],
    bunPackages: ["@yolo-web/google", "@yolo-web/auth"],
    cliLaunchCmd: "bun run ai:local --chat-port 8081 --coder-port 8082 --embed-port 8090",
    dockerHeadlessCmd: "docker run --rm --gpus all -p 8081:8081 -p 8082:8082 -p 8084:8084 -p 8090:8090 ghcr.io/aphrody-labs/uncensored-ai:latest",
    webgpuShaderWgsl: DEFAULT_WGSL_FRAGMENT,
    apiEndpoints: ["/api/apps/uncensored", "/app/uncensored", "/og/uncensored.svg", "/icon/uncensored.svg"],
    starsEstimate: 76500,
  },
  {
    id: "spacedrive",
    subdomain: "spacedrive",
    fqdn: "spacedrive.aphrody.app",
    url: "https://spacedrive.aphrody.app",
    pathAlias: "/app/spacedrive",
    title: "Spacedrive VDFS — Virtual Distributed File System",
    rankLabel: "Top-1 File Manager",
    category: "file_manager",
    upstreamRepo: "https://github.com/spacedriveapp/spacedrive",
    license: "Apache-2.0",
    primaryStack: "Rust + sd-core + OpenDAL + Iroh 1.4.1 P2P + Tauri v3",
    gpuBackend: "wgpu-24-webgpu-vulkan",
    wasmTarget: "hybrid-native-wasm",
    accentHex: "#00D4FF",
    phosphorIcon: "hard-drives",
    phosphorSvgPath: "M40,56H216a8,8,0,0,1,8,8v48a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V64A8,8,0,0,1,40,56Zm0,80H216a8,8,0,0,1,8,8v48a8,8,0,0,1-8,8H40a8,8,0,0,1-8-8V144A8,8,0,0,1,40,136Z",
    summaryEn:
      "Virtual Distributed File System indexing local NVMe volumes, Google Drive, S3/R2, and 3 Aphrody VPS nodes with content-addressable BLAKE3 hashing and Iroh QUIC sync.",
    summaryFr:
      "Système de fichiers distribué virtuel indexant NVMe locaux, Google Drive, S3/R2 et 3 VPS Aphrody avec hachage BLAKE3 et synchronisation QUIC Iroh.",
    sharedWorkspaceCrates: ["sd-core", "spacedrive", "yolo-tauri", "yolo-shared"],
    bunPackages: ["@spacedrive/ts-client", "@yolo-web/google"],
    cliLaunchCmd: "cargo run -p spacedrive -- daemon --bind 127.0.0.1:7230",
    dockerHeadlessCmd: "docker run --rm -v /var/lib/spacedrive:/data -p 7230:7230 ghcr.io/aphrody-labs/spacedrive-vdfs:latest",
    webgpuShaderWgsl: DEFAULT_WGSL_FRAGMENT,
    apiEndpoints: ["/api/apps/spacedrive", "/app/spacedrive", "/og/spacedrive.svg", "/icon/spacedrive.svg"],
    starsEstimate: 33900,
  },
  {
    id: "cosmic",
    subdomain: "cosmic",
    fqdn: "cosmic.aphrody.app",
    url: "https://cosmic.aphrody.app",
    pathAlias: "/app/cosmic",
    title: "COSMIC Full Desktop — libcosmic + Smithay Wayland Shell",
    rankLabel: "Top-1 Rust Desktop Environment",
    category: "desktop_env",
    upstreamRepo: "https://github.com/pop-os/cosmic-epoch",
    license: "GPL-3.0 / MPL-2.0",
    primaryStack: "Rust + libcosmic + Iced + Smithay Wayland + WGPU",
    gpuBackend: "wgpu-24-webgpu-vulkan",
    wasmTarget: "wasm32-unknown-unknown",
    accentHex: "#FFD700",
    phosphorIcon: "desktop",
    phosphorSvgPath: "M32,48H224a16,16,0,0,1,16,16V168a16,16,0,0,1-16,16H32a16,16,0,0,1-16-16V64A16,16,0,0,1,32,48ZM96,216h64m-32-32v32",
    summaryEn:
      "Complete Rust desktop environment combining System76 COSMIC Epoch, libcosmic reactive widgets, Smithay Wayland compositor, and yolo-engines cosmic theme bridge.",
    summaryFr:
      "Environnement de bureau complet en Rust combinant COSMIC Epoch, widgets réactifs libcosmic, compositeur Wayland Smithay et pont thématique yolo-engines.",
    sharedWorkspaceCrates: ["yolo-engines", "yolo-iced", "yolo-tokens", "yolo-shell"],
    bunPackages: ["@yolo-web/google"],
    cliLaunchCmd: "bun run ui launch cosmic --preset aphrody --dark",
    dockerHeadlessCmd: "docker run --rm --gpus all -p 8820:8820 ghcr.io/aphrody-labs/cosmic-webos:latest",
    webgpuShaderWgsl: DEFAULT_WGSL_FRAGMENT,
    apiEndpoints: ["/api/apps/cosmic", "/app/cosmic", "/og/cosmic.svg", "/icon/cosmic.svg"],
    starsEstimate: 14200,
  },
  {
    id: "bevy",
    subdomain: "bevy",
    fqdn: "bevy.aphrody.app",
    url: "https://bevy.aphrody.app",
    pathAlias: "/app/bevy",
    title: "Bevy Fullstack Engine — Unreal-Grade Browser & Headless 60GB CPK AI Game Builder",
    rankLabel: "Top-1 Fullstack Game Engine",
    category: "game_engine",
    upstreamRepo: "https://github.com/bevyengine/bevy",
    license: "MIT / Apache-2.0",
    primaryStack: "Rust + Bevy ECS + WGPU 24 PBR/Meshlets + yolo-re CRIWARE 60GB CPK + AI WGSL Generator",
    gpuBackend: "wgpu-24-webgpu-vulkan",
    wasmTarget: "wasm32-unknown-unknown",
    accentHex: "#FFD700",
    phosphorIcon: "cube-focus",
    phosphorSvgPath: "M128,32,216,80v96l-88,48L40,176V80Zm0,0v96m88-48-88,48L40,80",
    summaryEn:
      "Unreal Engine in Browser and Headless VPS/Docker: Bevy 0.16+ data-driven ECS paired with yolo-re CRIWARE 60GB .cpk streaming archives, headless Vulkan render workers, and AI procedural WGSL/ECS scene generation.",
    summaryFr:
      "Unreal Engine dans le navigateur et VPS/Docker headless : Bevy 0.16+ ECS couplé aux archives streaming CRIWARE .cpk de 60 Go (yolo-re), rendu Vulkan headless et génération procédurale IA.",
    sharedWorkspaceCrates: ["bevy", "yolo-gpu", "yolo-render", "yolo-re-cpk", "rapier3d"],
    bunPackages: ["@yolo-web/google", "@yolo-rs/ui-plugin"],
    cliLaunchCmd: "bun run bevy:cpk-build --cpk-size 60GB --target webgpu --headless-vps vps1.aphrody.com",
    dockerHeadlessCmd:
      "docker run --rm --gpus all -v /mnt/cpk60gb:/cpk -p 8830:8830 ghcr.io/aphrody-labs/bevy-cpk-headless:2026.11 --archive /cpk/world-60gb.cpk",
    webgpuShaderWgsl: DEFAULT_WGSL_FRAGMENT,
    apiEndpoints: ["/api/apps/bevy", "/api/bevy/cpk-builder", "/app/bevy", "/og/bevy.svg", "/icon/bevy.svg"],
    starsEstimate: 41200,
  },
  {
    id: "bevy-devtools",
    subdomain: "bevy-devtools",
    fqdn: "bevy-devtools.aphrody.app",
    url: "https://bevy-devtools.aphrody.app",
    pathAlias: "/app/bevy-devtools",
    title: "Bevy DevTools & Remote Inspector — BRP JSON-RPC & 60GB CPK Telemetry",
    rankLabel: "Top-1 Game Engine DevTools",
    category: "game_devtools",
    upstreamRepo: "https://github.com/bevyengine/bevy",
    license: "MIT / Apache-2.0",
    primaryStack: "Rust + Bevy Remote Protocol (BRP) + egui Inspector + Puffin Profiler",
    gpuBackend: "wgpu-24-webgpu-vulkan",
    wasmTarget: "wasm32-unknown-unknown",
    accentHex: "#7C5CFF",
    phosphorIcon: "gauge",
    phosphorSvgPath: "M32,184a96,96,0,1,1,192,0ZM128,184l48-72",
    summaryEn:
      "Real-time ECS World entity/component inspector over Bevy Remote Protocol (BRP JSON-RPC), WGSL render graph debugger, Puffin frame profiler, and 60GB CPK chunk streaming monitor.",
    summaryFr:
      "Inspecteur temps réel d'entités/composants ECS via Bevy Remote Protocol (BRP JSON-RPC), débogueur de graphe WGSL, profileur Puffin et moniteur de streaming CPK 60 Go.",
    sharedWorkspaceCrates: ["bevy_remote", "bevy-inspector-egui", "puffin", "yolo-gpu"],
    bunPackages: ["@yolo-web/google"],
    cliLaunchCmd: "bun run bevy:devtools --brp-url http://127.0.0.1:15702",
    dockerHeadlessCmd: "docker run --rm -p 15702:15702 ghcr.io/aphrody-labs/bevy-devtools:latest",
    webgpuShaderWgsl: DEFAULT_WGSL_FRAGMENT,
    apiEndpoints: ["/api/apps/bevy-devtools", "/app/bevy-devtools", "/og/bevy-devtools.svg", "/icon/bevy-devtools.svg"],
    starsEstimate: 18500,
  },
  {
    id: "tiny-glade",
    subdomain: "tiny-glade",
    fqdn: "tiny-glade.aphrody.app",
    url: "https://tiny-glade.aphrody.app",
    pathAlias: "/app/tiny-glade",
    title: "Tiny Glade Showcase — Procedural Castle & SDF Global Illumination",
    rankLabel: "Bevy Top-1 Game Showcase",
    category: "game_showcase",
    upstreamRepo: "https://github.com/EmbarkStudios/rust-ecosystem",
    license: "MIT / Apache-2.0",
    primaryStack: "Rust + Bevy ECS + WGPU Ray-Marched SDF + Real-Time Global Illumination",
    gpuBackend: "wgpu-24-webgpu-vulkan",
    wasmTarget: "wasm32-unknown-unknown",
    accentHex: "#FFD700",
    phosphorIcon: "castle-turret",
    phosphorSvgPath: "M48,216V88L80,88V56h32V88h32V56h32V88l32,0V216Z",
    summaryEn:
      "Procedural masonry, archway synthesis, signed-distance-field (SDF) voxel sculpting, and real-time screen-space & irradiance-probe global illumination in WebGPU.",
    summaryFr:
      "Maçonnerie procédurale, synthèse d'arches, sculpture SDF et illumination globale temps réel en WebGPU.",
    sharedWorkspaceCrates: ["bevy", "yolo-gpu", "yolo-render"],
    bunPackages: ["@yolo-web/google"],
    cliLaunchCmd: "bun run showcase:launch tiny-glade --webgpu",
    dockerHeadlessCmd: "docker run --rm --gpus all -p 8831:8831 ghcr.io/aphrody-labs/tiny-glade-demo:latest",
    webgpuShaderWgsl: DEFAULT_WGSL_FRAGMENT,
    apiEndpoints: ["/api/apps/tiny-glade", "/app/tiny-glade", "/og/tiny-glade.svg", "/icon/tiny-glade.svg"],
    starsEstimate: 22400,
  },
  {
    id: "veloren",
    subdomain: "veloren",
    fqdn: "veloren.aphrody.app",
    url: "https://veloren.aphrody.app",
    pathAlias: "/app/veloren",
    title: "Veloren Multiplayer Voxel RPG — 60GB CPK World Streaming",
    rankLabel: "Bevy/Rust Top-2 Game Showcase",
    category: "game_showcase",
    upstreamRepo: "https://github.com/veloren/veloren",
    license: "GPL-3.0",
    primaryStack: "Rust + Specs/Bevy ECS + WGPU Voxel Meshing + QUIC Multiplayer",
    gpuBackend: "wgpu-24-webgpu-vulkan",
    wasmTarget: "wasm32-unknown-unknown",
    accentHex: "#00D4FF",
    phosphorIcon: "mountains",
    phosphorSvgPath: "M16,200,88,72l56,96,32-56,64,88Z",
    summaryEn:
      "Open-world multiplayer voxel action RPG streaming terrain chunks, weather systems, and audio banks directly from 60GB CRIWARE CPK archives over WebGPU.",
    summaryFr:
      "Action-RPG voxel multijoueur en monde ouvert diffusant chunks de terrain, météo et banques audio depuis des archives CRIWARE CPK de 60 Go sur WebGPU.",
    sharedWorkspaceCrates: ["yolo-gpu", "yolo-re-cpk", "yolo-render"],
    bunPackages: ["@yolo-web/google"],
    cliLaunchCmd: "bun run showcase:launch veloren --server vps1.aphrody.com",
    dockerHeadlessCmd: "docker run --rm --gpus all -p 14004:14004 ghcr.io/aphrody-labs/veloren-server:latest",
    webgpuShaderWgsl: DEFAULT_WGSL_FRAGMENT,
    apiEndpoints: ["/api/apps/veloren", "/app/veloren", "/og/veloren.svg", "/icon/veloren.svg"],
    starsEstimate: 6100,
  },
  {
    id: "tunnet",
    subdomain: "tunnet",
    fqdn: "tunnet.aphrody.app",
    url: "https://tunnet.aphrody.app",
    pathAlias: "/app/tunnet",
    title: "Tunnet & ECS Physics Sandbox — Network Topology & Rapier3D",
    rankLabel: "Bevy Top-3 Game Showcase",
    category: "game_showcase",
    upstreamRepo: "https://github.com/bevyengine/bevy",
    license: "MIT / Apache-2.0",
    primaryStack: "Rust + Bevy ECS + Rapier3D Rigid-Body Physics + Spatial Audio",
    gpuBackend: "wgpu-24-webgpu-vulkan",
    wasmTarget: "wasm32-unknown-unknown",
    accentHex: "#4285F4",
    phosphorIcon: "graph",
    phosphorSvgPath: "M128,128m-24,0a24,24,0,1,0,48,0a24,24,0,1,0,-48,0M56,64l52,48m40,32,52,48M200,64l-52,48M108,144,56,192",
    summaryEn:
      "3D underground fiber/packet network engineering puzzle and Rapier3D deterministic physics sandbox running at 120 FPS in browser via Bevy WASM + WebGPU.",
    summaryFr:
      "Jeu d'ingénierie réseau 3D et bac à sable physique déterministe Rapier3D tournant à 120 FPS dans le navigateur via Bevy WASM + WebGPU.",
    sharedWorkspaceCrates: ["bevy", "rapier3d", "yolo-gpu"],
    bunPackages: ["@yolo-web/google"],
    cliLaunchCmd: "bun run showcase:launch tunnet --physics rapier3d",
    dockerHeadlessCmd: "docker run --rm --gpus all -p 8833:8833 ghcr.io/aphrody-labs/tunnet-sandbox:latest",
    webgpuShaderWgsl: DEFAULT_WGSL_FRAGMENT,
    apiEndpoints: ["/api/apps/tunnet", "/app/tunnet", "/og/tunnet.svg", "/icon/tunnet.svg"],
    starsEstimate: 9400,
  },
  {
    id: "gpui",
    subdomain: "gpui",
    fqdn: "gpui.aphrody.app",
    url: "https://gpui.aphrody.app",
    pathAlias: "/app/gpui",
    title: "GPUI Framework Studio — Analytical SDF & 120 FPS Hybrid UI",
    rankLabel: "Top-1 GPU UI Framework",
    category: "ui_framework",
    upstreamRepo: "https://github.com/zed-industries/zed",
    license: "Apache-2.0",
    primaryStack: "Rust + yolo-gpui + gpui-kit + Taffy Layout + WGPU Analytical SDF",
    gpuBackend: "gpui-wgpu-sdf",
    wasmTarget: "hybrid-native-wasm",
    accentHex: "#7C5CFF",
    phosphorIcon: "stack",
    phosphorSvgPath: "M32,80l96,56,96-56L128,24ZM32,128l96,56,96-56M32,176l96,56,96-56",
    summaryEn:
      "Zed's hybrid immediate/retained GPU UI framework integrated with yolo-tokens HCT/CAM16 schemes, subpixel text AA, and analytical signed-distance-field shadows.",
    summaryFr:
      "Framework UI GPU hybride de Zed intégré avec les schémas HCT/CAM16 yolo-tokens, anticrénelage sous-pixel et ombres SDF analytiques.",
    sharedWorkspaceCrates: ["yolo-gpui", "yolo-layout", "yolo-tokens", "yolo-shared"],
    bunPackages: ["@yolo-rs/ui-plugin"],
    cliLaunchCmd: "cargo run -p yolo-showcase -- --engine gpui --preset aphrody",
    dockerHeadlessCmd: "docker run --rm --gpus all -p 8840:8840 ghcr.io/aphrody-labs/gpui-studio:latest",
    webgpuShaderWgsl: DEFAULT_WGSL_FRAGMENT,
    apiEndpoints: ["/api/apps/gpui", "/app/gpui", "/og/gpui.svg", "/icon/gpui.svg"],
    starsEstimate: 28900,
  },
  {
    id: "egui",
    subdomain: "egui",
    fqdn: "egui.aphrody.app",
    url: "https://egui.aphrody.app",
    pathAlias: "/app/egui",
    title: "egui Immediate-Mode Studio — CADCraft & Node Graph Workbench",
    rankLabel: "Top-1 Immediate-Mode GUI",
    category: "ui_framework",
    upstreamRepo: "https://github.com/emilk/egui",
    license: "MIT / Apache-2.0",
    primaryStack: "Rust + egui + eframe + epaint WGPU + egui_tiles + egui_plot",
    gpuBackend: "wgpu-24-webgpu-vulkan",
    wasmTarget: "wasm32-unknown-unknown",
    accentHex: "#00D4FF",
    phosphorIcon: "sliders-horizontal",
    phosphorSvgPath: "M40,72H216M40,128H216M40,184H216M96,48V96m64,8v48M80,160v48",
    summaryEn:
      "Pure Rust immediate-mode GUI running on WGPU/WASM for CADCraft parametric modeling, shader node graphs, and zero-latency telemetry plots.",
    summaryFr:
      "GUI en mode immédiat pur Rust sur WGPU/WASM pour la modélisation paramétrique CADCraft, les graphes de shaders et les tracés télémétriques.",
    sharedWorkspaceCrates: ["yolo-engines", "yolo-tokens", "yolo-gpu"],
    bunPackages: ["@yolo-web/google"],
    cliLaunchCmd: "cargo run -p yolo-showcase -- --engine egui --preset aphrody",
    dockerHeadlessCmd: "docker run --rm --gpus all -p 8841:8841 ghcr.io/aphrody-labs/egui-studio:latest",
    webgpuShaderWgsl: DEFAULT_WGSL_FRAGMENT,
    apiEndpoints: ["/api/apps/egui", "/app/egui", "/og/egui.svg", "/icon/egui.svg"],
    starsEstimate: 24600,
  },
  {
    id: "iced",
    subdomain: "iced",
    fqdn: "iced.aphrody.app",
    url: "https://iced.aphrody.app",
    pathAlias: "/app/iced",
    title: "Iced & libcosmic Reactive GUI Studio — Elm Architecture in Rust",
    rankLabel: "Top-1 Elm-Architecture Rust GUI",
    category: "ui_framework",
    upstreamRepo: "https://github.com/iced-rs/iced",
    license: "MIT",
    primaryStack: "Rust + Iced 0.14 + Cryoglyph + Tiny-Skia + WGPU",
    gpuBackend: "wgpu-24-webgpu-vulkan",
    wasmTarget: "wasm32-unknown-unknown",
    accentHex: "#4285F4",
    phosphorIcon: "layout",
    phosphorSvgPath: "M32,48H224V208H32ZM32,96H224M96,96V208",
    summaryEn:
      "Type-safe Elm-inspired reactive Rust GUI toolkit with Cryoglyph text shaping, custom WGPU shader widgets, and full 8-preset yolo-tokens theme binding.",
    summaryFr:
      "Boîte à outils GUI Rust réactive inspirée d'Elm avec rendu de texte Cryoglyph, widgets shaders WGPU et liaison complète aux 8 thèmes yolo-tokens.",
    sharedWorkspaceCrates: ["yolo-iced", "yolo-engines", "yolo-tokens"],
    bunPackages: ["@yolo-web/google"],
    cliLaunchCmd: "cargo run -p yolo-showcase -- --engine iced --preset aphrody",
    dockerHeadlessCmd: "docker run --rm --gpus all -p 8842:8842 ghcr.io/aphrody-labs/iced-studio:latest",
    webgpuShaderWgsl: DEFAULT_WGSL_FRAGMENT,
    apiEndpoints: ["/api/apps/iced", "/app/iced", "/og/iced.svg", "/icon/iced.svg"],
    starsEstimate: 26100,
  },
  {
    id: "wgpu",
    subdomain: "wgpu",
    fqdn: "wgpu.aphrody.app",
    url: "https://wgpu.aphrody.app",
    pathAlias: "/app/wgpu",
    title: "WebGPU / WGPU Compute & Render Lab — Naga WGSL Shader Studio",
    rankLabel: "Top-1 Cross-Platform GPU API",
    category: "gpu_graphics",
    upstreamRepo: "https://github.com/gfx-rs/wgpu",
    license: "MIT / Apache-2.0",
    primaryStack: "Rust + wgpu 24 + Naga WGSL/SPIR-V Compiler + Dawn/WebGPU",
    gpuBackend: "wgpu-24-webgpu-vulkan",
    wasmTarget: "wasm32-unknown-unknown",
    accentHex: "#FFD700",
    phosphorIcon: "cpu",
    phosphorSvgPath: "M64,64H192V192H64ZM96,24V64m64-40V64M96,192v40m64-40v40M24,96H64m-40,64H64m128-64h40m-40,64h40",
    summaryEn:
      "Unified GPU compute and rendering layer powering Bevy, Zed GPUI, Rio, Iced, egui, and Locally Uncensored across Vulkan, Metal, DX12, and browser WebGPU.",
    summaryFr:
      "Couche unifiée de calcul et rendu GPU propulsant Bevy, Zed GPUI, Rio, Iced, egui et Locally Uncensored sur Vulkan, Metal, DX12 et WebGPU.",
    sharedWorkspaceCrates: ["yolo-gpu", "yolo-render", "wgpu", "naga"],
    bunPackages: ["@yolo-web/google"],
    cliLaunchCmd: "bun run gpu:lab --shader compute_raymarch.wgsl",
    dockerHeadlessCmd: "docker run --rm --gpus all -p 8845:8845 ghcr.io/aphrody-labs/wgpu-lab:latest",
    webgpuShaderWgsl: DEFAULT_WGSL_FRAGMENT,
    apiEndpoints: ["/api/apps/wgpu", "/app/wgpu", "/og/wgpu.svg", "/icon/wgpu.svg"],
    starsEstimate: 13400,
  },
  {
    id: "leptos",
    subdomain: "leptos",
    fqdn: "leptos.aphrody.app",
    url: "https://leptos.aphrody.app",
    pathAlias: "/app/leptos",
    title: "Leptos Fullstack Web — Fine-Grained Reactive SSR & WASM Islands",
    rankLabel: "Top-1 Rust Fullstack Web Framework",
    category: "web_fullstack",
    upstreamRepo: "https://github.com/leptos-rs/leptos",
    license: "MIT",
    primaryStack: "Rust + Leptos 0.8 + Axum SSR + WASM Islands + yolo-tokens CSS",
    gpuBackend: "wgpu-24-webgpu-vulkan",
    wasmTarget: "wasm32-unknown-unknown",
    accentHex: "#7C5CFF",
    phosphorIcon: "globe-hemisphere-west",
    phosphorSvgPath: "M128,24A104,104,0,1,0,232,128,104,104,0,0,0,128,24Zm-40,48h48l24,40-32,48H80Z",
    summaryEn:
      "Fine-grained reactive Rust web framework powering yolo-hub (yolo.aphrody.com) with zero-JS-by-default static export, strict CSP hashes, and WCAG 2.2 AA HCT palettes.",
    summaryFr:
      "Framework web Rust réactif à grain fin propulsant yolo-hub (yolo.aphrody.com) avec export statique sans JS requis, CSP stricte et palettes HCT WCAG 2.2 AA.",
    sharedWorkspaceCrates: ["yolo-tokens", "yolo-shared"],
    bunPackages: ["@yolo-web/google"],
    cliLaunchCmd: "cargo test --manifest-path C:/src/yolo-hub/Cargo.toml --no-default-features --features ssr",
    dockerHeadlessCmd: "docker run --rm -p 3000:3000 ghcr.io/aphrody-labs/yolo-hub-leptos:latest",
    webgpuShaderWgsl: DEFAULT_WGSL_FRAGMENT,
    apiEndpoints: ["/api/apps/leptos", "/app/leptos", "/og/leptos.svg", "/icon/leptos.svg"],
    starsEstimate: 18200,
  },
  {
    id: "taffy",
    subdomain: "taffy",
    fqdn: "taffy.aphrody.app",
    url: "https://taffy.aphrody.app",
    pathAlias: "/app/taffy",
    title: "Taffy 0.15 Layout Engine Lab — CSS Flexbox, Grid & Block Solver",
    rankLabel: "Top-1 UI Layout Solver",
    category: "layout_engine",
    upstreamRepo: "https://github.com/DioxusLabs/taffy",
    license: "MIT",
    primaryStack: "Rust + yolo-layout + Taffy 0.15 + Cosmic-Text Subpixel Measure",
    gpuBackend: "wgpu-24-webgpu-vulkan",
    wasmTarget: "wasm32-unknown-unknown",
    accentHex: "#00D4FF",
    phosphorIcon: "grid-four",
    phosphorSvgPath: "M40,40H112V112H40ZM144,40H216V112H144ZM40,144H112V216H40Zm104,0H216V216H144Z",
    summaryEn:
      "High-performance CSS Flexbox, CSS Grid, and Block layout solver shared across Dioxus Blitz, Bevy UI, Zed GPUI, and yolo-layout.",
    summaryFr:
      "Solveur de mise en page CSS Flexbox, CSS Grid et Block haute performance partagé entre Dioxus Blitz, Bevy UI, Zed GPUI et yolo-layout.",
    sharedWorkspaceCrates: ["yolo-layout", "taffy", "yolo-shared"],
    bunPackages: ["@yolo-web/google"],
    cliLaunchCmd: "cargo test -p yolo-layout",
    dockerHeadlessCmd: "docker run --rm -p 8847:8847 ghcr.io/aphrody-labs/taffy-lab:latest",
    webgpuShaderWgsl: DEFAULT_WGSL_FRAGMENT,
    apiEndpoints: ["/api/apps/taffy", "/app/taffy", "/og/taffy.svg", "/icon/taffy.svg"],
    starsEstimate: 3100,
  },
  {
    id: "awesome",
    subdomain: "awesome",
    fqdn: "awesome.aphrody.app",
    url: "https://awesome.aphrody.app",
    pathAlias: "/app/awesome",
    title: "Awesome Rust, Bun & WebGPU Index — Live SQLite FTS5 & Redis Directory",
    rankLabel: "Top-1 Curated Ecosystem Index",
    category: "ecosystem_index",
    upstreamRepo: "https://github.com/yolo-rs/yolo-ui",
    license: "Apache-2.0",
    primaryStack: "Bun v1.4.4+ + bun:sqlite FTS5 + Bun.redis + Reproducible Crawler",
    gpuBackend: "wgpu-24-webgpu-vulkan",
    wasmTarget: "wasm32-unknown-unknown",
    accentHex: "#FFD700",
    phosphorIcon: "compass",
    phosphorSvgPath: "M128,24A104,104,0,1,0,232,128,104,104,0,0,0,128,24Zm36,68-24,60-60,24,24-60Z",
    summaryEn:
      "Continuously crawled, deduplicated, and FTS5-indexed directory of the top Rust, Upstream Bun v1.4.4+, Bevy, and WebGPU repositories synced to SQLite WAL and Redis.",
    summaryFr:
      "Annuaire indexé en continu via FTS5 des meilleurs dépôts Rust, Upstream Bun v1.4.4+, Bevy et WebGPU synchronisé dans SQLite WAL et Redis.",
    sharedWorkspaceCrates: ["yolo-shared", "yolo-tokens"],
    bunPackages: ["@yolo-web/google", "@yolo-web/brave-shields"],
    cliLaunchCmd: "bun run packages/google/src/search-server.ts --sync-catalog",
    dockerHeadlessCmd: "docker run --rm -p 8850:8793 ghcr.io/aphrody-labs/awesome-index:latest",
    webgpuShaderWgsl: DEFAULT_WGSL_FRAGMENT,
    apiEndpoints: ["/api/catalog", "/api/crawler/sync", "/app/awesome", "/og/awesome.svg", "/icon/awesome.svg"],
    starsEstimate: 45000,
  },
  {
    id: "showcase",
    subdomain: "showcase",
    fqdn: "showcase.aphrody.app",
    url: "https://showcase.aphrody.app",
    pathAlias: "/app/showcase",
    title: "Aphrody & YOLO Interactive Showcase — 60 FPS WebGPU & 16 Craft Apps",
    rankLabel: "Top-1 Interactive Showcase",
    category: "interactive_showcase",
    upstreamRepo: "https://github.com/yolo-rs/yolo-ui",
    license: "Apache-2.0",
    primaryStack: "Rust + yolo-showcase + 8 HCT Theme Presets + WebGPU Live Canvas",
    gpuBackend: "wgpu-24-webgpu-vulkan",
    wasmTarget: "wasm32-unknown-unknown",
    accentHex: "#4285F4",
    phosphorIcon: "sparkle",
    phosphorSvgPath: "M128,16l28,76,76,28-76,28-28,76-28-76L24,120l76-28Z",
    summaryEn:
      "Interactive gallery of all 8 yolo-ui HCT/CAM16 theme presets, 23 Omarchy subthemes, Byron Love 10-teinte sprite companion, 16 Craft apps, and Bevy 60GB CPK streaming.",
    summaryFr:
      "Galerie interactive des 8 thèmes HCT/CAM16 yolo-ui, 23 sous-thèmes Omarchy, compagnon Byron Love, 16 applications Craft et streaming Bevy CPK 60 Go.",
    sharedWorkspaceCrates: ["yolo-showcase", "yolo-tokens", "yolo-shared", "yolo-emit"],
    bunPackages: ["@yolo-web/google", "@yolo-rs/ui-plugin"],
    cliLaunchCmd: "cargo run -p yolo-showcase",
    dockerHeadlessCmd: "docker run --rm --gpus all -p 8851:8851 ghcr.io/aphrody-labs/yolo-showcase:latest",
    webgpuShaderWgsl: DEFAULT_WGSL_FRAGMENT,
    apiEndpoints: ["/api/apps/showcase", "/app/showcase", "/og/showcase.svg", "/icon/showcase.svg"],
    starsEstimate: 19800,
  },
  {
    id: "templates",
    subdomain: "templates",
    fqdn: "templates.aphrody.app",
    url: "https://templates.aphrody.app",
    pathAlias: "/app/templates",
    title: "Shared Monorepo Starter Templates — 1-Click Rust/Bun/WebGPU Scaffolds",
    rankLabel: "Top-1 Monorepo Templates",
    category: "monorepo_templates",
    upstreamRepo: "https://github.com/yolo-rs/yolo-ui",
    license: "MIT / Apache-2.0",
    primaryStack: "Cargo [workspace.dependencies] + Bun Workspaces + Shared WGPU Target",
    gpuBackend: "wgpu-24-webgpu-vulkan",
    wasmTarget: "hybrid-native-wasm",
    accentHex: "#7C5CFF",
    phosphorIcon: "folders",
    phosphorSvgPath: "M32,64H96l24,24H224V200H32ZM64,40h64l24,24h72V168",
    summaryEn:
      "Zero-duplication starter templates sharing a single Cargo.lock, bun.lock, shared target cache, and unified WGPU 24 backend across Bevy, GPUI, Iced, egui, and Leptos.",
    summaryFr:
      "Modèles de démarrage sans duplication partageant un seul Cargo.lock, bun.lock, cache target et backend WGPU 24 unifié entre Bevy, GPUI, Iced, egui et Leptos.",
    sharedWorkspaceCrates: ["yolo-shared", "yolo-tokens", "yolo-gpu", "yolo-layout"],
    bunPackages: ["@yolo-web/google", "@yolo-rs/ui-plugin"],
    cliLaunchCmd: "bun create aphrody-app my-studio --template bevy-wgpu-cpk",
    dockerHeadlessCmd: "docker run --rm ghcr.io/aphrody-labs/monorepo-templates:latest",
    webgpuShaderWgsl: DEFAULT_WGSL_FRAGMENT,
    apiEndpoints: ["/api/shared-monorepo", "/app/templates", "/og/templates.svg", "/icon/templates.svg"],
    starsEstimate: 15600,
  },
  {
    id: "docs",
    subdomain: "docs",
    fqdn: "docs.aphrody.app",
    url: "https://docs.aphrody.app",
    pathAlias: "/app/docs",
    title: "Unified Aphrody & YOLO Engineering Documentation — Specs & DTCG Contracts",
    rankLabel: "Top-1 Engineering Documentation",
    category: "engineering_docs",
    upstreamRepo: "https://github.com/yolo-rs/yolo-ui",
    license: "Apache-2.0",
    primaryStack: "Markdown + W3C DTCG Tokens + Evolving Google/Aphrody HCT Specs + OpenAPI",
    gpuBackend: "wgpu-24-webgpu-vulkan",
    wasmTarget: "wasm32-unknown-unknown",
    accentHex: "#00D4FF",
    phosphorIcon: "book-open-text",
    phosphorSvgPath: "M128,64c-24-16-64-16-96-8V192c32-8,72-8,96,8,24-16,64-16,96-8V56C192,48,152,48,128,64Zm0,0V200",
    summaryEn:
      "Complete architectural specifications covering the Evolving Google & Aphrody HCT color math, Chromium Views/WebUI contracts, Bevy 60GB CPK streaming, and Bun v1.4.4+ APIs.",
    summaryFr:
      "Spécifications architecturales complètes couvrant les mathématiques couleur HCT Google & Aphrody, les contrats Chromium WebUI, le streaming Bevy CPK 60 Go et Bun v1.4.4+.",
    sharedWorkspaceCrates: ["yolo-tokens", "yolo-emit", "yolo-contracts"],
    bunPackages: ["@yolo-web/google"],
    cliLaunchCmd: "bun run ui docs --serve",
    dockerHeadlessCmd: "docker run --rm -p 8852:8852 ghcr.io/aphrody-labs/docs-portal:latest",
    webgpuShaderWgsl: DEFAULT_WGSL_FRAGMENT,
    apiEndpoints: ["/api/apps/docs", "/app/docs", "/og/docs.svg", "/icon/docs.svg"],
    starsEstimate: 12900,
  },
];

export const SHARED_MONOREPO_SPEC: SharedMonorepoSpec = {
  workspaceName: "aphrody-yolo-shared-monorepo",
  rustEdition: "2024",
  rustToolchain: "1.95.0",
  bunVersion: "1.4.4+",
  sharedCargoTargetDir: "/var/cache/aphrody/cargo-target",
  sharedGpuBackend: {
    crate: "wgpu",
    version: "24.0.1",
    nativeBackends: ["Vulkan", "Metal", "DX12", "GLES3"],
    browserBackend: "WebGPU + Dawn + WebGL2 fallback",
    shaderPipeline: "Naga WGSL + SPIR-V + MSL + HLSL",
  },
  workspaceDependencies: {
    "yolo-shared": "0.8.0",
    "yolo-tokens": "0.8.0",
    "yolo-layout": "0.8.0",
    "yolo-render": "0.8.0",
    "yolo-gpu": "0.8.0",
    "yolo-engines": "0.8.0",
    wgpu: "24.0.1",
    bevy: "0.16.0",
    taffy: "0.15.0",
    leptos: "0.8.23",
    egui: "0.31.0",
    iced: "0.14.0",
    serde: "1.0.219",
    tokio: "1.44.0",
  },
  packageJsonWorkspaces: [
    "packages/*",
    "apps/*",
    "crates/*",
  ],
};

export function buildBevy60GbCpkBlueprint(): Bevy60GbCpkBlueprint {
  return {
    id: "bevy-cpk-60gb-ai-builder",
    engine: "Bevy 0.16+ Fullstack WebGPU & Headless Vulkan",
    archiveFormat: "CRIWARE CPK (yolo-re ie_cpk_pack / ie_cpk_extract / 60GB streaming)",
    maxArchiveBytes: 64_424_509_440,
    maxArchiveLabel: "60 GB (64,424,509,440 bytes)",
    chunkSizeMb: 64,
    compressionCodec: "CRILAYLA + Zstd + LZ4 streaming blocks",
    headlessDockerImage: "ghcr.io/aphrody-labs/bevy-cpk-headless:2026.11",
    vpsNodes: [
      {
        node: "vps1-paris",
        role: "Headless Vulkan Render + CPK Baker",
        host: "vps1.aphrody.com",
      },
      {
        node: "vps2-frankfurt",
        role: "AI Agent Procedural ECS/WGSL Generator",
        host: "vps2.aphrody.com",
      },
      {
        node: "vps3-tokyo",
        role: "60GB CPK Edge CDN + HTTP Range Streamer",
        host: "vps3.aphrody.com",
      },
    ],
    aiPipelineStages: [
      {
        stage: 1,
        name: "Prompt & World Blueprint Synthesis",
        tool: "uncensored.aphrody.app (Qwen-Coder :8082 + :8084)",
        description:
          "Generates deterministic Bevy ECS component graphs, Rapier3D colliders, and procedural WGSL materials from natural language or reverse-engineered game specs.",
      },
      {
        stage: 2,
        name: "60 GB CRIWARE CPK Archive Packing & TOC Indexing",
        tool: "yolo-re (ie_cpk_pack / ie_cpk_list / ie_cpk_extract)",
        description:
          "Packs high-resolution glTF 2.0 meshes, KTX2 BasisU textures, CRI HCA/ADX2 spatial audio, and WGSL shaders into a 60 GB indexed .cpk container with 64 MB HTTP Range chunks.",
      },
      {
        stage: 3,
        name: "Headless VPS/Docker Vulkan Bake & Lightmap GI",
        tool: "bevy-cpk-headless (Vulkan / wgpu 24)",
        description:
          "Runs Bevy in headless schedule mode inside Docker on VPS to bake SDF irradiance volumes, navmeshes, and deterministic physics replays.",
      },
      {
        stage: 4,
        name: "Browser WebGPU Streaming & Live BRP DevTools",
        tool: "bevy.aphrody.app + bevy-devtools.aphrody.app",
        description:
          "Streams 64 MB CPK slices on demand into browser WebGPU buffers via HTTP 206 Partial Content while exposing live ECS inspection over Bevy Remote Protocol.",
      },
    ],
    ecsManifestSample: {
      sceneName: "AphrodyCelestialCitadel60GB",
      entities: 250_000,
      wgslShaders: [
        "shaders/pbr_celestial_gold.wgsl",
        "shaders/sdf_global_illumination.wgsl",
        "shaders/water_caustics_fft.wgsl",
      ],
      cpkMounts: [
        "cpk://world-60gb.cpk/regions/olympus_sector_01.bin",
        "cpk://world-60gb.cpk/textures/ktx2_8k_atlas.cpk",
        "cpk://world-60gb.cpk/audio/cri_hca_orchestra.acb",
      ],
    },
    sampleWgslPbrShader: DEFAULT_WGSL_FRAGMENT,
  };
}

export function findAphrodyTop1App(subdomainOrId: string): AphrodyTop1AppSpec | undefined {
  const clean = subdomainOrId.trim().toLowerCase().replace(/\.aphrody\.app$/, "");
  return APHRODY_TOP1_RUST_BUN_CATALOG.find(
    (item) => item.id === clean || item.subdomain === clean,
  );
}

export function extractAphrodyAppSubdomainFromHost(hostHeader: string | null | undefined): string | null {
  if (!hostHeader) return null;
  const host = hostHeader.trim().toLowerCase().split(":")[0] || "";
  if (!host.endsWith(".aphrody.app")) return null;
  const sub = host.slice(0, -".aphrody.app".length);
  if (!sub || sub === "www") return null;
  return sub;
}

function resolveDefaultCatalogSqlitePath(): string {
  if (process.env.APHRODY_CATALOG_DB_PATH) {
    return process.env.APHRODY_CATALOG_DB_PATH;
  }
  if (process.platform === "win32") {
    return resolve(process.cwd(), ".cache", "aphrody-catalog.sqlite");
  }
  return "/var/lib/aphrody/catalog.sqlite";
}

/**
 * Reproducible Crawler & SQLite (WAL + FTS5) + Redis Sync Engine.
 * Populates `aphrody_apps`, `bevy_cpk_pipelines`, `crawl_runs`, and FTS5 table `aphrody_apps_fts`,
 * then writes keys `aphrody:catalog:all`, `aphrody:app:<subdomain>`, and `aphrody:bevy:cpk60gb` to Redis.
 */
export async function syncCatalogToSqlAndRedis(options?: {
  sqlitePath?: string;
  redisUrl?: string;
  query?: string;
}): Promise<CrawlerSyncReceipt> {
  let sqlitePath = options?.sqlitePath || resolveDefaultCatalogSqlitePath();
  try {
    mkdirSync(dirname(sqlitePath), { recursive: true });
  } catch {
    sqlitePath = resolve(process.cwd(), ".cache", "aphrody-catalog.sqlite");
    mkdirSync(dirname(sqlitePath), { recursive: true });
  }

  const db = new Database(sqlitePath, { create: true });
  let walEnabled = false;
  try {
    db.exec("PRAGMA journal_mode = WAL;");
    db.exec("PRAGMA synchronous = NORMAL;");
    walEnabled = true;
  } catch {
    walEnabled = false;
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS aphrody_apps (
      id TEXT PRIMARY KEY,
      subdomain TEXT NOT NULL UNIQUE,
      fqdn TEXT NOT NULL,
      url TEXT NOT NULL,
      title TEXT NOT NULL,
      rank_label TEXT NOT NULL,
      category TEXT NOT NULL,
      upstream_repo TEXT NOT NULL,
      license TEXT NOT NULL,
      primary_stack TEXT NOT NULL,
      gpu_backend TEXT NOT NULL,
      wasm_target TEXT NOT NULL,
      accent_hex TEXT NOT NULL,
      summary_en TEXT NOT NULL,
      summary_fr TEXT NOT NULL,
      cli_launch_cmd TEXT NOT NULL,
      docker_headless_cmd TEXT NOT NULL,
      stars_estimate INTEGER NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bevy_cpk_pipelines (
      id TEXT PRIMARY KEY,
      engine TEXT NOT NULL,
      archive_format TEXT NOT NULL,
      max_archive_bytes INTEGER NOT NULL,
      chunk_size_mb INTEGER NOT NULL,
      headless_docker_image TEXT NOT NULL,
      blueprint_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS crawl_runs (
      run_id TEXT PRIMARY KEY,
      timestamp_iso TEXT NOT NULL,
      apps_synced INTEGER NOT NULL,
      fts5_indexed INTEGER NOT NULL,
      redis_connected INTEGER NOT NULL
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS aphrody_apps_fts USING fts5(
      id,
      subdomain,
      title,
      rank_label,
      category,
      primary_stack,
      summary_en,
      summary_fr
    );
  `);

  const nowIso = new Date().toISOString();
  const upsertApp = db.prepare(`
    INSERT INTO aphrody_apps (
      id, subdomain, fqdn, url, title, rank_label, category, upstream_repo,
      license, primary_stack, gpu_backend, wasm_target, accent_hex,
      summary_en, summary_fr, cli_launch_cmd, docker_headless_cmd, stars_estimate, updated_at
    ) VALUES (
      $id, $subdomain, $fqdn, $url, $title, $rankLabel, $category, $upstreamRepo,
      $license, $primaryStack, $gpuBackend, $wasmTarget, $accentHex,
      $summaryEn, $summaryFr, $cliLaunchCmd, $dockerHeadlessCmd, $starsEstimate, $updatedAt
    )
    ON CONFLICT(id) DO UPDATE SET
      fqdn = excluded.fqdn,
      url = excluded.url,
      title = excluded.title,
      rank_label = excluded.rank_label,
      category = excluded.category,
      upstream_repo = excluded.upstream_repo,
      license = excluded.license,
      primary_stack = excluded.primary_stack,
      gpu_backend = excluded.gpu_backend,
      wasm_target = excluded.wasm_target,
      accent_hex = excluded.accent_hex,
      summary_en = excluded.summary_en,
      summary_fr = excluded.summary_fr,
      cli_launch_cmd = excluded.cli_launch_cmd,
      docker_headless_cmd = excluded.docker_headless_cmd,
      stars_estimate = excluded.stars_estimate,
      updated_at = excluded.updated_at;
  `);

  db.exec("DELETE FROM aphrody_apps_fts;");
  const insertFts = db.prepare(`
    INSERT INTO aphrody_apps_fts (
      id, subdomain, title, rank_label, category, primary_stack, summary_en, summary_fr
    ) VALUES ($id, $subdomain, $title, $rankLabel, $category, $primaryStack, $summaryEn, $summaryFr);
  `);

  const tx = db.transaction((apps: readonly AphrodyTop1AppSpec[]) => {
    for (const app of apps) {
      upsertApp.run({
        $id: app.id,
        $subdomain: app.subdomain,
        $fqdn: app.fqdn,
        $url: app.url,
        $title: app.title,
        $rankLabel: app.rankLabel,
        $category: app.category,
        $upstreamRepo: app.upstreamRepo,
        $license: app.license,
        $primaryStack: app.primaryStack,
        $gpuBackend: app.gpuBackend,
        $wasmTarget: app.wasmTarget,
        $accentHex: app.accentHex,
        $summaryEn: app.summaryEn,
        $summaryFr: app.summaryFr,
        $cliLaunchCmd: app.cliLaunchCmd,
        $dockerHeadlessCmd: app.dockerHeadlessCmd,
        $starsEstimate: app.starsEstimate,
        $updatedAt: nowIso,
      });
      insertFts.run({
        $id: app.id,
        $subdomain: app.subdomain,
        $title: app.title,
        $rankLabel: app.rankLabel,
        $category: app.category,
        $primaryStack: app.primaryStack,
        $summaryEn: app.summaryEn,
        $summaryFr: app.summaryFr,
      });
    }
  });
  tx(APHRODY_TOP1_RUST_BUN_CATALOG);

  const cpkBlueprint = buildBevy60GbCpkBlueprint();
  db.prepare(`
    INSERT INTO bevy_cpk_pipelines (
      id, engine, archive_format, max_archive_bytes, chunk_size_mb,
      headless_docker_image, blueprint_json, updated_at
    ) VALUES ($id, $engine, $archiveFormat, $maxBytes, $chunkMb, $dockerImage, $json, $updatedAt)
    ON CONFLICT(id) DO UPDATE SET
      engine = excluded.engine,
      archive_format = excluded.archive_format,
      max_archive_bytes = excluded.max_archive_bytes,
      chunk_size_mb = excluded.chunk_size_mb,
      headless_docker_image = excluded.headless_docker_image,
      blueprint_json = excluded.blueprint_json,
      updated_at = excluded.updated_at;
  `).run({
    $id: cpkBlueprint.id,
    $engine: cpkBlueprint.engine,
    $archiveFormat: cpkBlueprint.archiveFormat,
    $maxBytes: cpkBlueprint.maxArchiveBytes,
    $chunkMb: cpkBlueprint.chunkSizeMb,
    $dockerImage: cpkBlueprint.headlessDockerImage,
    $json: JSON.stringify(cpkBlueprint),
    $updatedAt: nowIso,
  });

  const ftsCountRow = db
    .query<{ count: number }, []>("SELECT count(*) as count FROM aphrody_apps_fts;")
    .get();
  const fts5IndexedCount = ftsCountRow?.count ?? APHRODY_TOP1_RUST_BUN_CATALOG.length;

  const redisUrl = options?.redisUrl || process.env.REDIS_URL || "redis://127.0.0.1:6379";
  const redisKeysWritten: string[] = [];
  let redisConnected = false;

  try {
    const bunAny = Bun as unknown as {
      redis?: {
        set: (key: string, value: string) => Promise<unknown>;
      };
      RedisClient?: new (url?: string) => {
        set: (key: string, value: string) => Promise<unknown>;
        close?: () => void;
      };
    };

    const client = bunAny.RedisClient
      ? new bunAny.RedisClient(redisUrl)
      : bunAny.redis;

    if (client && typeof client.set === "function") {
      await Promise.race([
        (async () => {
          await client.set(
            "aphrody:catalog:all",
            JSON.stringify(APHRODY_TOP1_RUST_BUN_CATALOG),
          );
          redisKeysWritten.push("aphrody:catalog:all");
          for (const app of APHRODY_TOP1_RUST_BUN_CATALOG) {
            const key = `aphrody:app:${app.subdomain}`;
            await client.set(key, JSON.stringify(app));
            redisKeysWritten.push(key);
          }
          await client.set("aphrody:bevy:cpk60gb", JSON.stringify(cpkBlueprint));
          redisKeysWritten.push("aphrody:bevy:cpk60gb");
          redisConnected = true;
        })(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Redis sync timeout")), 350),
        ),
      ]);
      if ("close" in client && typeof client.close === "function") {
        client.close();
      }
    }
  } catch {
    redisConnected = false;
  }

  const runId = `crawl-${Date.now()}`;
  db.prepare(`
    INSERT INTO crawl_runs (run_id, timestamp_iso, apps_synced, fts5_indexed, redis_connected)
    VALUES ($runId, $timestampIso, $appsSynced, $fts5Indexed, $redisConnected);
  `).run({
    $runId: runId,
    $timestampIso: nowIso,
    $appsSynced: APHRODY_TOP1_RUST_BUN_CATALOG.length,
    $fts5Indexed: fts5IndexedCount,
    $redisConnected: redisConnected ? 1 : 0,
  });

  db.close();

  return {
    runId,
    timestampIso: nowIso,
    sqlitePath,
    sqliteWalEnabled: walEnabled,
    fts5IndexedCount,
    totalAppsSynced: APHRODY_TOP1_RUST_BUN_CATALOG.length,
    bevyPipelinesSynced: 1,
    redisConnected,
    redisUrl,
    redisKeysWritten,
  };
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Generates Dynamic SVG Phosphor Vector Icon (`/icon/:subdomain.svg`).
 */
export function renderAphrodyAppIconSvg(subdomain: string): string {
  const app = findAphrodyTop1App(subdomain) ?? APHRODY_TOP1_RUST_BUN_CATALOG[0]!;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-label="${escapeXml(app.title)} Icon">
  <defs>
    <linearGradient id="aphrody-bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0A0E17"/>
      <stop offset="50%" stop-color="#17335C"/>
      <stop offset="100%" stop-color="#0A0E17"/>
    </linearGradient>
    <linearGradient id="aphrody-stroke" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${app.accentHex}"/>
      <stop offset="50%" stop-color="#7C5CFF"/>
      <stop offset="100%" stop-color="#00D4FF"/>
    </linearGradient>
  </defs>
  <rect width="256" height="256" rx="56" fill="url(#aphrody-bg)" stroke="url(#aphrody-stroke)" stroke-width="6"/>
  <path d="${app.phosphorSvgPath}" fill="none" stroke="${app.accentHex}" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
}

/**
 * Generates Dynamic 1200x630 SVG OpenGraph Social Card (`/og/:subdomain.svg`).
 */
export function renderAphrodyAppOgSvg(subdomain: string): string {
  const app = findAphrodyTop1App(subdomain) ?? APHRODY_TOP1_RUST_BUN_CATALOG[0]!;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630" role="img" aria-label="${escapeXml(app.title)} OpenGraph">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0A0E17"/>
      <stop offset="55%" stop-color="#17335C"/>
      <stop offset="100%" stop-color="#0A0E17"/>
    </linearGradient>
    <linearGradient id="bar" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#4285F4"/>
      <stop offset="25%" stop-color="#7C5CFF"/>
      <stop offset="55%" stop-color="#00D4FF"/>
      <stop offset="100%" stop-color="#FFD700"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect x="0" y="0" width="1200" height="10" fill="url(#bar)"/>
  <rect x="64" y="64" width="1072" height="502" rx="28" fill="#0A0E17" fill-opacity="0.72" stroke="${app.accentHex}" stroke-width="2"/>
  <g transform="translate(110, 115) scale(0.45)">
    <rect width="256" height="256" rx="48" fill="#17335C" stroke="${app.accentHex}" stroke-width="8"/>
    <path d="${app.phosphorSvgPath}" fill="none" stroke="${app.accentHex}" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
  <text x="255" y="160" fill="#FFD700" font-family="'Cinzel', serif" font-size="26" font-weight="700" letter-spacing="2">${escapeXml(app.rankLabel.toUpperCase())} — ${escapeXml(app.fqdn.toUpperCase())}</text>
  <text x="255" y="210" fill="#F8FAFC" font-family="'Plus Jakarta Sans', sans-serif" font-size="40" font-weight="800">${escapeXml(app.title)}</text>
  <text x="110" y="305" fill="#CBD5E1" font-family="'Plus Jakarta Sans', sans-serif" font-size="24">${escapeXml(app.summaryEn.slice(0, 108))}...</text>
  <text x="110" y="385" fill="#00D4FF" font-family="'JetBrains Mono', monospace" font-size="21">Stack: ${escapeXml(app.primaryStack)}</text>
  <text x="110" y="430" fill="#7C5CFF" font-family="'JetBrains Mono', monospace" font-size="20">GPU: ${escapeXml(app.gpuBackend)} | WASM: ${escapeXml(app.wasmTarget)} | License: ${escapeXml(app.license)}</text>
  <text x="110" y="510" fill="#FFD700" font-family="'Cinzel', serif" font-size="22" font-weight="700">APHRODY.COM &amp; *.APHRODY.APP — SHARED RUST + BUN v1.4.4+ + WEBGPU MONOREPO</text>
</svg>`;
}

/**
 * Generates XML Sitemap (`GET /sitemap.xml`) covering `aphrody.com` + all 21 `*.aphrody.app` portals.
 */
export function renderAphrodySitemapXml(): string {
  const urls: string[] = [
    "https://aphrody.com/",
    "https://aphrody.com/search",
    "https://aphrody.com/api/catalog",
    "https://aphrody.com/api/bevy/cpk-builder",
  ];
  for (const app of APHRODY_TOP1_RUST_BUN_CATALOG) {
    urls.push(app.url);
    urls.push(`https://aphrody.com${app.pathAlias}`);
  }
  const entries = urls
    .map(
      (loc) =>
        `  <url>\n    <loc>${escapeXml(loc)}</loc>\n    <changefreq>daily</changefreq>\n    <priority>0.9</priority>\n  </url>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
}

/**
 * Generates `GET /robots.txt`.
 */
export function renderAphrodyRobotsTxt(): string {
  return [
    "User-agent: *",
    "Allow: /",
    "Sitemap: https://aphrody.com/sitemap.xml",
    "",
  ].join("\n");
}

/**
 * Renders the complete interactive HTML/WebGPU/WASM portal for any `*.aphrody.app` subdomain
 * or `/app/:subdomain` route.
 * Strictly follows the `yolo-aphrody` HCT/CAM16 dark-first palette (`#0A0E17`, `#17335C`, `#FFD700`,
 * `#7C5CFF`, `#00D4FF`, `#4285F4`), fonts `'Cinzel'`, `'Plus Jakarta Sans'`, `'JetBrains Mono'`,
 * inline Phosphor SVG vector icons, zero emojis, live WebGPU/Canvas2D shader preview, and AI CLI/Docker builder.
 */
export function renderAphrodyAppSubdomainHtml(subdomain: string): string {
  const app = findAphrodyTop1App(subdomain) ?? APHRODY_TOP1_RUST_BUN_CATALOG[0]!;
  const isBevy = app.id === "bevy" || app.id === "bevy-devtools" || app.category === "game_showcase";
  const cpkBlueprint = buildBevy60GbCpkBlueprint();

  const navPills = APHRODY_TOP1_RUST_BUN_CATALOG.map((item) => {
    const active = item.id === app.id ? ' class="pill active"' : ' class="pill"';
    return `<a${active} href="/app/${item.subdomain}" data-subdomain="${item.subdomain}">${escapeXml(item.subdomain)}.aphrody.app</a>`;
  }).join("\n          ");

  const cratesBadges = app.sharedWorkspaceCrates
    .map((c) => `<span class="crate-badge">${escapeXml(c)}</span>`)
    .join(" ");

  const cpkSectionHtml = isBevy
    ? `<section class="panel cpk-panel" id="bevy-60gb-cpk">
        <div class="panel-head">
          <h2>Bevy 60 GB CRIWARE CPK Headless VPS/Docker &amp; AI Game Builder</h2>
          <span class="tag-gold">${escapeXml(cpkBlueprint.maxArchiveLabel)}</span>
        </div>
        <p class="panel-desc">
          Unreal-grade browser &amp; headless cloud pipeline powered by <code>bevy 0.16+</code>, <code>wgpu 24</code>, and <code>yolo-re</code> (<code>ie_cpk_pack</code> / <code>ie_cpk_extract</code>) streaming 64 MB HTTP Range slices directly into WebGPU buffers.
        </p>
        <div class="grid-2">
          ${cpkBlueprint.aiPipelineStages
            .map(
              (s) => `<div class="stage-card">
            <div class="stage-num">STAGE 0${s.stage} — ${escapeXml(s.tool)}</div>
            <h3>${escapeXml(s.name)}</h3>
            <p>${escapeXml(s.description)}</p>
          </div>`,
            )
            .join("\n          ")}
        </div>
      </section>`
    : "";

  return `<!DOCTYPE html>
<html lang="en" data-yolo-theme="aphrody" data-mode="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeXml(app.title)} | ${escapeXml(app.fqdn)}</title>
  <meta name="description" content="${escapeXml(app.summaryEn)}" />
  <link rel="canonical" href="${escapeXml(app.url)}" />
  <link rel="icon" type="image/svg+xml" href="/icon/${escapeXml(app.subdomain)}.svg" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Aphrody.app Ecosystem" />
  <meta property="og:title" content="${escapeXml(app.title)}" />
  <meta property="og:description" content="${escapeXml(app.summaryEn)}" />
  <meta property="og:url" content="${escapeXml(app.url)}" />
  <meta property="og:image" content="https://aphrody.com/og/${escapeXml(app.subdomain)}.svg" />
  <meta name="twitter:card" content="summary_large_image" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;800&family=JetBrains+Mono:wght@400;600&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <style>
    :root {
      --aphrody-bg-canvas: #0A0E17;
      --aphrody-bg-navy: #17335C;
      --aphrody-gold: #FFD700;
      --aphrody-violet: #7C5CFF;
      --aphrody-cyan: #00D4FF;
      --aphrody-blue: #4285F4;
      --aphrody-accent: ${app.accentHex};
      --aphrody-text: #F8FAFC;
      --aphrody-muted: #94A3B8;
      --font-display: 'Cinzel', serif;
      --font-sans: 'Plus Jakarta Sans', system-ui, sans-serif;
      --font-mono: 'JetBrains Mono', monospace;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: radial-gradient(circle at 15% 10%, #17335C 0%, #0A0E17 55%);
      color: var(--aphrody-text);
      font-family: var(--font-sans);
      min-height: 100vh;
      line-height: 1.6;
    }
    .topbar {
      border-bottom: 1px solid rgba(255, 215, 0, 0.18);
      background: rgba(10, 14, 23, 0.88);
      backdrop-filter: blur(16px);
      padding: 0.9rem 1.75rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      flex-wrap: wrap;
    }
    .brand {
      display: inline-flex;
      align-items: center;
      gap: 0.75rem;
      text-decoration: none;
      color: var(--aphrody-gold);
      font-family: var(--font-display);
      font-weight: 800;
      font-size: 1.15rem;
      letter-spacing: 0.06em;
    }
    .brand svg {
      width: 28px;
      height: 28px;
      stroke: var(--aphrody-accent);
    }
    .top-links {
      display: flex;
      gap: 0.75rem;
      align-items: center;
      flex-wrap: wrap;
    }
    .top-links a {
      color: var(--aphrody-text);
      text-decoration: none;
      font-size: 0.88rem;
      font-weight: 600;
      padding: 0.45rem 0.9rem;
      border-radius: 999px;
      background: rgba(23, 51, 92, 0.55);
      border: 1px solid rgba(0, 212, 255, 0.25);
    }
    .top-links a:hover {
      border-color: var(--aphrody-gold);
      color: var(--aphrody-gold);
    }
    .container {
      max-width: 1280px;
      margin: 0 auto;
      padding: 2rem 1.5rem 4rem;
      display: grid;
      gap: 1.75rem;
    }
    .pill-strip {
      display: flex;
      gap: 0.45rem;
      overflow-x: auto;
      padding-bottom: 0.5rem;
    }
    .pill {
      white-space: nowrap;
      text-decoration: none;
      font-family: var(--font-mono);
      font-size: 0.76rem;
      color: var(--aphrody-muted);
      padding: 0.35rem 0.75rem;
      border-radius: 999px;
      background: rgba(10, 14, 23, 0.75);
      border: 1px solid rgba(124, 92, 255, 0.25);
    }
    .pill.active, .pill:hover {
      color: #0A0E17;
      background: var(--aphrody-gold);
      border-color: var(--aphrody-gold);
      font-weight: 600;
    }
    .hero-grid {
      display: grid;
      grid-template-columns: 1.25fr 0.95fr;
      gap: 1.5rem;
      align-items: stretch;
    }
    @media (max-width: 960px) {
      .hero-grid { grid-template-columns: 1fr; }
    }
    .panel {
      background: rgba(10, 14, 23, 0.78);
      border: 1px solid rgba(124, 92, 255, 0.28);
      border-radius: 20px;
      padding: 1.6rem;
      display: grid;
      gap: 1rem;
    }
    .rank-kicker {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      font-family: var(--font-display);
      font-size: 0.82rem;
      color: var(--aphrody-gold);
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    h1 {
      font-family: var(--font-display);
      font-size: clamp(1.65rem, 2.5vw, 2.35rem);
      line-height: 1.2;
      background: linear-gradient(95deg, #FFD700 0%, #00D4FF 55%, #7C5CFF 100%);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }
    .summary { color: #E2E8F0; font-size: 1rem; }
    .summary-fr { color: var(--aphrody-muted); font-size: 0.92rem; font-style: italic; }
    .meta-table {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.65rem;
      padding-top: 0.5rem;
    }
    .meta-box {
      padding: 0.7rem 0.9rem;
      border-radius: 12px;
      background: rgba(23, 51, 92, 0.38);
      border: 1px solid rgba(0, 212, 255, 0.18);
    }
    .meta-label {
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--aphrody-cyan);
      font-family: var(--font-mono);
    }
    .meta-val {
      font-size: 0.86rem;
      font-weight: 600;
      color: var(--aphrody-text);
      font-family: var(--font-mono);
      word-break: break-word;
    }
    .crate-badge {
      display: inline-block;
      padding: 0.2rem 0.6rem;
      border-radius: 8px;
      background: rgba(124, 92, 255, 0.2);
      border: 1px solid var(--aphrody-violet);
      font-family: var(--font-mono);
      font-size: 0.75rem;
      color: #F8FAFC;
      margin: 0.15rem;
    }
    .shader-card {
      position: relative;
      display: grid;
      grid-template-rows: auto 1fr auto;
      gap: 0.75rem;
    }
    canvas#webgpu-canvas {
      width: 100%;
      height: 250px;
      border-radius: 14px;
      border: 1px solid var(--aphrody-cyan);
      background: #0A0E17;
    }
    pre {
      background: #060911;
      border: 1px solid rgba(66, 133, 244, 0.35);
      border-radius: 12px;
      padding: 0.85rem 1rem;
      overflow-x: auto;
      font-family: var(--font-mono);
      font-size: 0.8rem;
      color: #00D4FF;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 1rem;
    }
    .stage-card {
      padding: 1rem;
      border-radius: 14px;
      background: rgba(23, 51, 92, 0.42);
      border: 1px solid rgba(255, 215, 0, 0.25);
      display: grid;
      gap: 0.4rem;
    }
    .stage-num {
      font-family: var(--font-mono);
      font-size: 0.72rem;
      color: var(--aphrody-gold);
    }
    .tag-gold {
      font-family: var(--font-mono);
      font-size: 0.78rem;
      padding: 0.25rem 0.7rem;
      border-radius: 999px;
      background: rgba(255, 215, 0, 0.16);
      border: 1px solid var(--aphrody-gold);
      color: var(--aphrody-gold);
    }
    .panel-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      flex-wrap: wrap;
    }
    h2 {
      font-family: var(--font-display);
      font-size: 1.25rem;
      color: var(--aphrody-gold);
    }
  </style>
</head>
<body>
  <header class="topbar">
    <a class="brand" href="/">
      <svg viewBox="0 0 256 256" fill="none" stroke-width="16" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="${app.phosphorSvgPath}" />
      </svg>
      <span>${escapeXml(app.fqdn.toUpperCase())}</span>
    </a>
    <nav class="top-links" aria-label="Aphrody Ecosystem Navigation">
      <a href="/search?q=${encodeURIComponent(app.title)}">Aphrody Search</a>
      <a href="/api/apps/${escapeXml(app.subdomain)}">JSON Spec</a>
      <a href="/api/catalog">Full Top-1 Catalog</a>
      <a href="/api/bevy/cpk-builder">Bevy 60GB CPK API</a>
      <a href="/og/${escapeXml(app.subdomain)}.svg">OpenGraph SVG</a>
    </nav>
  </header>

  <main class="container">
    <nav class="pill-strip" aria-label="All *.aphrody.app Subdomains">
      ${navPills}
    </nav>

    <section class="hero-grid">
      <article class="panel">
        <div class="rank-kicker">
          <span>${escapeXml(app.rankLabel)}</span>
          <span>|</span>
          <span>${escapeXml(app.category)}</span>
        </div>
        <h1>${escapeXml(app.title)}</h1>
        <p class="summary">${escapeXml(app.summaryEn)}</p>
        <p class="summary-fr">${escapeXml(app.summaryFr)}</p>

        <div class="meta-table">
          <div class="meta-box">
            <div class="meta-label">Subdomain FQDN</div>
            <div class="meta-val">${escapeXml(app.fqdn)}</div>
          </div>
          <div class="meta-box">
            <div class="meta-label">GPU Backend</div>
            <div class="meta-val">${escapeXml(app.gpuBackend)}</div>
          </div>
          <div class="meta-box">
            <div class="meta-label">WASM Target</div>
            <div class="meta-val">${escapeXml(app.wasmTarget)}</div>
          </div>
          <div class="meta-box">
            <div class="meta-label">Upstream &amp; License</div>
            <div class="meta-val">${escapeXml(app.license)}</div>
          </div>
        </div>

        <div>
          <div class="meta-label">Shared Workspace Crates ([workspace.dependencies])</div>
          <div style="margin-top:0.35rem">${cratesBadges}</div>
        </div>
      </article>

      <aside class="panel shader-card">
        <div class="panel-head">
          <h2>Live WebGPU / WGSL Surface Preview</h2>
          <span class="tag-gold" id="gpu-status">WebGPU / Canvas2D Active</span>
        </div>
        <canvas id="webgpu-canvas" width="520" height="250"></canvas>
        <div>
          <div class="meta-label">Shared Monorepo CLI &amp; Headless Docker Launch</div>
          <pre><code>$ ${escapeXml(app.cliLaunchCmd)}
$ ${escapeXml(app.dockerHeadlessCmd)}</code></pre>
        </div>
      </aside>
    </section>

    ${cpkSectionHtml}

    <section class="panel">
      <div class="panel-head">
        <h2>WGSL Shader Kernel (${escapeXml(app.gpuBackend)})</h2>
        <span class="tag-gold">Naga WGSL Verified</span>
      </div>
      <pre><code>${escapeXml(app.webgpuShaderWgsl)}</code></pre>
    </section>
  </main>

  <script>
    (function () {
      var canvas = document.getElementById("webgpu-canvas");
      if (!canvas) return;
      var ctx = canvas.getContext("2d");
      if (!ctx) return;
      var t = 0;
      function frame() {
        t += 0.025;
        var w = canvas.width, h = canvas.height;
        var grad = ctx.createLinearGradient(0, 0, w, h);
        grad.addColorStop(0, "#0A0E17");
        grad.addColorStop(0.45, "#17335C");
        grad.addColorStop(0.78, "${app.accentHex}");
        grad.addColorStop(1, "#7C5CFF");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "rgba(255, 215, 0, 0.45)";
        ctx.lineWidth = 1.5;
        for (var i = 0; i < 6; i++) {
          ctx.beginPath();
          for (var x = 0; x <= w; x += 12) {
            var y = h * 0.5 + Math.sin(x * 0.02 + t + i * 0.7) * (22 + i * 6);
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    })();
  </script>
</body>
</html>`;
}
