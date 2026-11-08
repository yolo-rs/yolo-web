// SPDX-License-Identifier: Apache-2.0
// Cloudflare Edge Worker for Static Docs, WebAssembly (.wasm), WebGPU Shaders (.wgsl) & LLMs.txt

export interface EdgeEnv {
  ASSETS?: { fetch: (req: Request) => Promise<Response> };
  GCP_PRIMARY_REGION?: string;
  STARGARDT_WCAG_LEVEL?: string;
}

export default {
  async fetch(request: Request, env: EdgeEnv): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/edge-status") {
      return Response.json(
        {
          service: "google-bun-sovereign-edge",
          edgeRuntime: "cloudflare-workers-wasm-webgpu",
          gcpBackendRegion: env.GCP_PRIMARY_REGION ?? "europe-west9",
          wcagLevel: env.STARGARDT_WCAG_LEVEL ?? "AAA",
          assetsServed: [
            "/index.html",
            "/llms.txt",
            "/robots.txt",
            "/assets/google_bun_wasm.wasm",
            "/assets/stargardt.wgsl",
            "/api/benchmarks.json",
          ],
        },
        {
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "public, max-age=60",
          },
        },
      );
    }

    if (env.ASSETS) {
      const assetRes = await env.ASSETS.fetch(request);
      const headers = new Headers(assetRes.headers);
      if (url.pathname.endsWith(".wasm")) {
        headers.set("Content-Type", "application/wasm");
        headers.set("Cache-Control", "public, max-age=31536000, immutable");
      } else if (url.pathname.endsWith(".wgsl")) {
        headers.set("Content-Type", "text/wgsl; charset=utf-8");
      }
      headers.set("Cross-Origin-Opener-Policy", "same-origin");
      headers.set("Cross-Origin-Embedder-Policy", "require-corp");
      return new Response(assetRes.body, {
        status: assetRes.status,
        headers,
      });
    }

    return new Response("Google-Bun Sovereign Edge Active", { status: 200 });
  },
};
