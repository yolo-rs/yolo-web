// SPDX-License-Identifier: Apache-2.0
/**
 * Aphrody Flagship Ecosystem Catalog & Evolving Google Identity (2026)
 *
 * Implements the unified Aphrody (`aphrody.com`) product experience inspired by
 * https://design.google/library/evolving-google-identity:
 * - Dynamic 4-stop Evolving Google Gradient (#4285F4 -> #9B72CB -> #D96570 -> #F4B400)
 * - Fused with Aphrody Identity Palette (Gold #FFD700, Violet #7C5CFF, Cyan #00D4FF, Deep Navy #17335C, Pet Mauve #8C6C88)
 * - Material 3 Expressive HCT/CAM16 tokens & Google Sans / Product Sans geometric metrics
 * - Complete 16-app Google LLC -> Aphrody Web & Android 17 x64 Ecosystem Registry
 * - Search verticals, Knowledge Graph cards, and AI Mode / Gemini Overview synthesis
 */

export interface AphrodyIdentitySpec {
  readonly brand: "Aphrody";
  readonly domain: "aphrody.com";
  readonly org: "aphrody-labs";
  readonly coreLibrary: "yolo";
  readonly inspirationUrl: "https://design.google/library/evolving-google-identity";
  readonly evolvingGradient: {
    readonly stops: readonly [
      { readonly stop: "0%"; readonly hex: "#4285F4"; readonly name: "Google Blue" },
      { readonly stop: "33%"; readonly hex: "#9B72CB"; readonly name: "Evolving Violet" },
      { readonly stop: "66%"; readonly hex: "#D96570"; readonly name: "Evolving Coral" },
      { readonly stop: "100%"; readonly hex: "#F4B400"; readonly name: "Google Gold" },
    ];
    readonly css: string;
    readonly aphrodyFusionCss: string;
  };
  readonly aphrodyBrandPalette: {
    readonly gold: "#FFD700";
    readonly violet: "#7C5CFF";
    readonly cyan: "#00D4FF";
    readonly deepNavy: "#17335C";
    readonly petMauveSeed: "#8C6C88";
    readonly blondSeed: "#EADBA6";
  };
  readonly typography: {
    readonly display: string;
    readonly sans: string;
    readonly text: string;
    readonly mono: string;
  };
  readonly m3Expressive: {
    readonly colorSpace: "HCT/CAM16";
    readonly preset: "aphrody";
    readonly shapeCornerSmall: "8px";
    readonly shapeCornerMedium: "12px";
    readonly shapeCornerLarge: "16px";
    readonly shapeCornerFull: "9999px";
    readonly searchCapsuleRadius: "28px";
  };
}

export const APHRODY_IDENTITY: AphrodyIdentitySpec = {
  brand: "Aphrody",
  domain: "aphrody.com",
  org: "aphrody-labs",
  coreLibrary: "yolo",
  inspirationUrl: "https://design.google/library/evolving-google-identity",
  evolvingGradient: {
    stops: [
      { stop: "0%", hex: "#4285F4", name: "Google Blue" },
      { stop: "33%", hex: "#9B72CB", name: "Evolving Violet" },
      { stop: "66%", hex: "#D96570", name: "Evolving Coral" },
      { stop: "100%", hex: "#F4B400", name: "Google Gold" },
    ],
    css: "linear-gradient(90deg, #4285F4 0%, #9B72CB 33%, #D96570 66%, #F4B400 100%)",
    aphrodyFusionCss:
      "linear-gradient(105deg, #4285F4 0%, #7C5CFF 25%, #9B72CB 45%, #D96570 68%, #F4B400 85%, #FFD700 100%)",
  },
  aphrodyBrandPalette: {
    gold: "#FFD700",
    violet: "#7C5CFF",
    cyan: "#00D4FF",
    deepNavy: "#17335C",
    petMauveSeed: "#8C6C88",
    blondSeed: "#EADBA6",
  },
  typography: {
    display:
      '"Cinzel", "Product Sans", "Google Sans Display", "Google Sans Flex", "Plus Jakarta Sans", "Aphrody Display", system-ui, sans-serif',
    sans: '"Plus Jakarta Sans", "Google Sans", "Google Sans Flex", "Aphrody Sans", system-ui, sans-serif',
    text: '"Plus Jakarta Sans", "Google Sans Text", "Google Sans", "Google Sans Flex", system-ui, sans-serif',
    mono: '"JetBrains Mono", "Google Sans Mono", monospace',
  },
  m3Expressive: {
    colorSpace: "HCT/CAM16",
    preset: "aphrody",
    shapeCornerSmall: "8px",
    shapeCornerMedium: "12px",
    shapeCornerLarge: "16px",
    shapeCornerFull: "9999px",
    searchCapsuleRadius: "28px",
  },
};

export type AphrodySearchVertical =
  | "all"
  | "ai"
  | "images"
  | "videos"
  | "news"
  | "maps"
  | "shopping"
  | "books"
  | "code"
  | "scholar";

export interface AphrodyVerticalTab {
  readonly id: AphrodySearchVertical;
  readonly labelEn: string;
  readonly labelFr: string;
  readonly icon: string;
}

export const APHRODY_SEARCH_VERTICALS: readonly AphrodyVerticalTab[] = [
  { id: "all", labelEn: "All", labelFr: "Tous", icon: "search" },
  { id: "ai", labelEn: "AI Mode", labelFr: "Mode IA", icon: "auto_awesome" },
  { id: "images", labelEn: "Images", labelFr: "Images", icon: "image" },
  { id: "videos", labelEn: "Videos", labelFr: "Vidéos", icon: "smart_display" },
  { id: "news", labelEn: "News", labelFr: "Actualités", icon: "newspaper" },
  { id: "maps", labelEn: "Maps", labelFr: "Maps", icon: "location_on" },
  { id: "shopping", labelEn: "Shopping", labelFr: "Shopping", icon: "shopping_bag" },
  { id: "books", labelEn: "Books", labelFr: "Livres", icon: "menu_book" },
  { id: "code", labelEn: "Code", labelFr: "Code", icon: "terminal" },
  { id: "scholar", labelEn: "Scholar", labelFr: "Scholar", icon: "school" },
];

export interface AphrodyEcosystemApp {
  readonly id: string;
  readonly name: string;
  readonly googleEquivalent: string;
  readonly url: string;
  readonly category: "search_ai" | "workspace" | "communication" | "media_geo" | "platform_os";
  readonly icon: string;
  readonly accentHex: string;
  readonly descriptionEn: string;
  readonly descriptionFr: string;
  readonly runtime: string;
  readonly androidPackage?: string;
}

/** Complete Google LLC -> Aphrody.com Web & Android 17 x64 Ecosystem Registry */
export const APHRODY_APPS_ECOSYSTEM: readonly AphrodyEcosystemApp[] = [
  {
    id: "search",
    name: "Aphrody Search",
    googleEquivalent: "Google Search",
    url: "https://aphrody.com/search",
    category: "search_ai",
    icon: "search",
    accentHex: "#4285F4",
    descriptionEn: "Universal web index, Knowledge Graph, Voice, Lens & AI Overview.",
    descriptionFr: "Index web universel, Knowledge Graph, Recherche vocale, Lens et Aperçu IA.",
    runtime: "yolo-web + aphrody-site",
    androidPackage: "com.aphrody.android.googlequicksearchbox",
  },
  {
    id: "ai",
    name: "Aphrody AI / Gemini",
    googleEquivalent: "Google Gemini & AI Studio",
    url: "https://ai.aphrody.com",
    category: "search_ai",
    icon: "auto_awesome",
    accentHex: "#9B72CB",
    descriptionEn: "Multimodal AI assistant, Deep Research, Canvas & local-first RAG.",
    descriptionFr: "Assistant IA multimodal, Deep Research, Canvas et RAG local-first.",
    runtime: "yolo-ai + aphrody-gemini-runtime",
    androidPackage: "com.aphrody.android.apps.bard",
  },
  {
    id: "drive",
    name: "Aphrody Drive",
    googleEquivalent: "Google Drive",
    url: "https://drive.aphrody.com",
    category: "workspace",
    icon: "cloud_done",
    accentHex: "#34A853",
    descriptionEn: "Cloud & local-first VFS storage powered by Spacedrive + Google Drive sync.",
    descriptionFr: "Stockage cloud et VFS local-first propulsé par Spacedrive + synchro Google Drive.",
    runtime: "aphrody-drive + spacedrive",
    androidPackage: "com.aphrody.android.apps.docs",
  },
  {
    id: "docs",
    name: "Docs / WordCraft",
    googleEquivalent: "Google Docs",
    url: "https://docs.aphrody.com",
    category: "workspace",
    icon: "description",
    accentHex: "#4285F4",
    descriptionEn: "Collaborative rich-text & Markdown studio with native Google Docs sync.",
    descriptionFr: "Studio de traitement de texte et Markdown collaboratif avec synchro Google Docs.",
    runtime: "wordcraft-engine + @yolo-web/google",
    androidPackage: "com.aphrody.android.apps.docs.editors.docs",
  },
  {
    id: "sheets",
    name: "Sheets / GridCraft",
    googleEquivalent: "Google Sheets",
    url: "https://sheets.aphrody.com",
    category: "workspace",
    icon: "table_chart",
    accentHex: "#34A853",
    descriptionEn: "High-speed GPU spreadsheet engine, formulas, and data analytics.",
    descriptionFr: "Tableur haute performance accéléré par GPU, formules et analytique.",
    runtime: "gridcraft-engine + yolo-ui",
    androidPackage: "com.aphrody.android.apps.docs.editors.sheets",
  },
  {
    id: "slides",
    name: "Slides / DeckCraft",
    googleEquivalent: "Google Slides",
    url: "https://slides.aphrody.com",
    category: "workspace",
    icon: "slideshow",
    accentHex: "#F4B400",
    descriptionEn: "Expressive presentation studio with PPTX & Google Slides parity.",
    descriptionFr: "Studio de présentation expressif compatible PPTX et Google Slides.",
    runtime: "deckcraft + @yolo-web/google",
    androidPackage: "com.aphrody.android.apps.docs.editors.slides",
  },
  {
    id: "mail",
    name: "Aphrody Mail",
    googleEquivalent: "Gmail",
    url: "https://mail.aphrody.com",
    category: "communication",
    icon: "mail",
    accentHex: "#EA4335",
    descriptionEn: "Zero-trust encrypted email & Gmail API workspace client with AI triage.",
    descriptionFr: "Client mail chiffré zéro-trust et espace Gmail avec tri IA.",
    runtime: "aphrody-backend + @yolo-web/google",
    androidPackage: "com.aphrody.android.gm",
  },
  {
    id: "meet",
    name: "Aphrody Meet",
    googleEquivalent: "Google Meet",
    url: "https://meet.aphrody.com",
    category: "communication",
    icon: "videocam",
    accentHex: "#00D4FF",
    descriptionEn: "Low-latency WebRTC video conferencing with live AI captions & translation.",
    descriptionFr: "Visioconférence WebRTC basse latence avec sous-titres et traduction IA en direct.",
    runtime: "yolo-web + aphrody-voice",
    androidPackage: "com.aphrody.android.apps.tachyon",
  },
  {
    id: "calendar",
    name: "Aphrody Calendar",
    googleEquivalent: "Google Calendar",
    url: "https://calendar.aphrody.com",
    category: "workspace",
    icon: "calendar_month",
    accentHex: "#4285F4",
    descriptionEn: "Intelligent time orchestration, autonomous scheduling & Temporal API.",
    descriptionFr: "Orchestration intelligente du temps, planification autonome et API Temporal.",
    runtime: "aphrody-jobs + yolo-ui",
    androidPackage: "com.aphrody.android.calendar",
  },
  {
    id: "photos",
    name: "Aphrody Photos",
    googleEquivalent: "Google Photos",
    url: "https://photos.aphrody.com",
    category: "media_geo",
    icon: "photo_library",
    accentHex: "#D96570",
    descriptionEn: "PhotoCraft & LightCraft RAW/WebGPU gallery with semantic vision search.",
    descriptionFr: "Galerie RAW/WebGPU PhotoCraft & LightCraft avec recherche visuelle sémantique.",
    runtime: "photocraft-engine + lightcraft-engine",
    androidPackage: "com.aphrody.android.apps.photos",
  },
  {
    id: "translate",
    name: "Aphrody Translate",
    googleEquivalent: "Google Translate",
    url: "https://translate.aphrody.com",
    category: "search_ai",
    icon: "translate",
    accentHex: "#4285F4",
    descriptionEn: "Neural multilingual translation across 130+ languages (FR/EN/JA native).",
    descriptionFr: "Traduction neuronale multilingue dans plus de 130 langues (FR/EN/JA natif).",
    runtime: "aphrody-translate + aphrody-translate-core",
    androidPackage: "com.aphrody.android.apps.translate",
  },
  {
    id: "maps",
    name: "Aphrody Maps",
    googleEquivalent: "Google Maps",
    url: "https://maps.aphrody.com",
    category: "media_geo",
    icon: "explore",
    accentHex: "#34A853",
    descriptionEn: "3D WebGPU vector cartography, geospatial intelligence & routing.",
    descriptionFr: "Cartographie vectorielle 3D WebGPU, intelligence géospatiale et itinéraires.",
    runtime: "yolo-web + vectorcraft-render",
    androidPackage: "com.aphrody.android.apps.maps",
  },
  {
    id: "video",
    name: "Aphrody Video / Media",
    googleEquivalent: "YouTube",
    url: "https://video.aphrody.com",
    category: "media_geo",
    icon: "play_circle",
    accentHex: "#EA4335",
    descriptionEn: "FilmCraft & EffectCraft streaming studio, 4K WebGPU playback & creator hub.",
    descriptionFr: "Studio de streaming FilmCraft & EffectCraft, lecture 4K WebGPU et hub créateur.",
    runtime: "filmcraft-engine + effectcraft-gpu",
    androidPackage: "com.aphrody.android.youtube",
  },
  {
    id: "play",
    name: "Aphrody Play Store",
    googleEquivalent: "Google Play Store",
    url: "https://play.aphrody.com",
    category: "platform_os",
    icon: "shop",
    accentHex: "#00D4FF",
    descriptionEn: "Android 17 x64 Google Play apps, F-Droid, WebGPU/WASM & signed YOLO plugins.",
    descriptionFr: "Applications Android 17 x64 Google Play, F-Droid, WebGPU/WASM et plugins YOLO signés.",
    runtime: "yolo-os + yolo-plugins + bunos-flutter-store",
    androidPackage: "com.android.vending",
  },
  {
    id: "console",
    name: "Aphrody Cloud Console",
    googleEquivalent: "Google Cloud Console",
    url: "https://console.aphrody.com",
    category: "platform_os",
    icon: "terminal",
    accentHex: "#FFD700",
    descriptionEn: "Fleet orchestration, OVH/Cloudflare edge workers, AI models & telemetry.",
    descriptionFr: "Orchestration de flotte, workers edge OVH/Cloudflare, modèles IA et télémétrie.",
    runtime: "aphrody-infra + aphrody-ovh + yolo-vps",
    androidPackage: "com.aphrody.android.apps.cloudconsole",
  },
  {
    id: "os",
    name: "Chromium OS / GoogleBook Shell",
    googleEquivalent: "ChromeOS / Aluminium OS",
    url: "https://os.aphrody.com",
    category: "platform_os",
    icon: "laptop_chromebook",
    accentHex: "#7C5CFF",
    descriptionEn: "2026 GoogleBook Laptop OS: Aluminium OS + Chromium OS + Android 17 x64 + Bun v1.4.4+.",
    descriptionFr: "OS GoogleBook 2026 : Aluminium OS + Chromium OS + Android 17 x64 + Bun v1.4.4+.",
    runtime: "yolo-os + aphrody-webos-server",
    androidPackage: "com.aphrody.os.shell",
  },
];

export interface AphrodyKnowledgeCard {
  readonly title: string;
  readonly subtitle: string;
  readonly description: string;
  readonly url: string;
  readonly badge: string;
  readonly attributes: readonly { readonly label: string; readonly value: string }[];
}

export interface AphrodyAiOverview {
  readonly enabled: boolean;
  readonly model: string;
  readonly summary: string;
  readonly highlights: readonly string[];
  readonly citations: readonly { readonly title: string; readonly url: string }[];
}

export function buildKnowledgeCard(query: string, lang: string): AphrodyKnowledgeCard {
  const isFr = lang === "fr";
  const q = query.toLowerCase();

  if (q.includes("googlebook") || q.includes("aluminium") || q.includes("android") || q.includes("os")) {
    return {
      title: "Aphrody OS — 2026 GoogleBook",
      subtitle: isFr
        ? "Convergence Aluminium OS, Chromium OS & Android 17 x64"
        : "Aluminium OS, Chromium OS & Android 17 x64 Convergence",
      description: isFr
        ? "Le système d'exploitation phare d'Aphrody pour le GoogleBook Laptop 2026 : noyau Linux 7.4-rc, image Google Play Android 17 (API 37 Baklava/CinnamonBun) x86_64 via ARCVM/Wayland, services Chromium OS (crosh, vmc, concierge, sommelier), userland Rust et runtime Upstream Bun v1.4.4+."
        : "Aphrody's flagship operating system for the 2026 GoogleBook Laptop: Linux 7.4-rc kernel, Android 17 (API 37 Baklava/CinnamonBun) x86_64 Google Play image via ARCVM/Wayland, Chromium OS system services (crosh, vmc, concierge, sommelier), Rust userland, and Upstream Bun v1.4.4+.",
      url: "https://os.aphrody.com",
      badge: "GoogleBook 2026",
      attributes: isFr
        ? [
            { label: "Organisation :", value: "Aphrody (aphrody.com / aphrody-labs)" },
            { label: "Sous-système Android :", value: "Android 17 x86_64 (API 37 Google Play)" },
            { label: "Shell & Compositeur :", value: "Aluminium OS + CrOS Ash/Lacros + yolo-ui M3" },
            { label: "Noyau & Runtime :", value: "Linux 7.4-rc + Rust + Upstream Bun v1.4.4+" },
          ]
        : [
            { label: "Organization:", value: "Aphrody (aphrody.com / aphrody-labs)" },
            { label: "Android Subsystem:", value: "Android 17 x86_64 (API 37 Google Play)" },
            { label: "Shell & Compositor:", value: "Aluminium OS + CrOS Ash/Lacros + yolo-ui M3" },
            { label: "Kernel & Runtime:", value: "Linux 7.4-rc + Rust + Upstream Bun v1.4.4+" },
          ],
    };
  }

  return {
    title: "Aphrody",
    subtitle: isFr
      ? "Plateforme Web Universelle, IA & Écosystème GoogleBook 2026"
      : "Universal Web Platform, AI & 2026 GoogleBook Ecosystem",
    description: isFr
      ? "Aphrody (aphrody.com) est le produit public phare et l'organisation principale construite sur le socle de bibliothèques fondamentales YOLO (Rust + Upstream Bun v1.4.4+). Elle réunit la recherche universelle, l'IA multimodale Gemini, la suite créative Craft/Workspace (Docs, Sheets, Slides, Drive, Mail, Meet) et l'OS GoogleBook 2026."
      : "Aphrody (aphrody.com) is the flagship public product and main organization powered by the YOLO core library ecosystem (Rust + Upstream Bun v1.4.4+). It unifies universal web search, multimodal Gemini AI, the Craft/Workspace suite (Docs, Sheets, Slides, Drive, Mail, Meet), and the 2026 GoogleBook OS.",
    url: "https://aphrody.com",
    badge: "Evolving Identity 2026",
    attributes: isFr
      ? [
          { label: "Produit Public :", value: "Aphrody (aphrody.com)" },
          { label: "Bibliothèque Core :", value: "YOLO (yolo-ui, yolo-web, yolo-ai, yolo-os)" },
          { label: "Design System :", value: "Material 3 Expressive HCT/CAM16 + Gradient 4 couleurs" },
          { label: "Runtime :", value: "Rust + Upstream Bun v1.4.4+ + WebGPU" },
        ]
      : [
          { label: "Public Product:", value: "Aphrody (aphrody.com)" },
          { label: "Core Library:", value: "YOLO (yolo-ui, yolo-web, yolo-ai, yolo-os)" },
          { label: "Design System:", value: "Material 3 Expressive HCT/CAM16 + 4-Color Gradient" },
          { label: "Runtime:", value: "Rust + Upstream Bun v1.4.4+ + WebGPU" },
        ],
  };
}

export function buildAiOverview(query: string, lang: string): AphrodyAiOverview {
  const isFr = lang === "fr";
  const cleanQuery = query.trim() || "Aphrody";
  return {
    enabled: true,
    model: "aphrody-gemini-2.5-pro",
    summary: isFr
      ? `Synthèse IA Aphrody pour « ${cleanQuery} » : L'écosystème Aphrody.com unifie l'expérience complète de Google.com (Recherche, Knowledge Graph, AI Mode, Workspace Docs/WordCraft, Sheets/GridCraft, Slides/DeckCraft, Drive, Play Store) avec l'identité visuelle Evolving Google 2026 et le système d'exploitation GoogleBook Laptop 2026 (Android 17 x64 + Chromium OS + Aluminium OS + Bun v1.4.4+).`
      : `Aphrody AI Overview for "${cleanQuery}": The Aphrody.com platform unifies the full Google.com experience (Search, Knowledge Graph, AI Mode, Workspace Docs/WordCraft, Sheets/GridCraft, Slides/DeckCraft, Drive, Play Store) with the 2026 Evolving Google Identity and the 2026 GoogleBook Laptop OS (Android 17 x64 + Chromium OS + Aluminium OS + Bun v1.4.4+).`,
    highlights: isFr
      ? [
          "Identité 2026 : Dégradé dynamique à 4 arrêts (#4285F4 -> #9B72CB -> #D96570 -> #F4B400) fusionné avec l'or (#FFD700) et le bleu marine (#17335C) d'Aphrody.",
          "16 applications Web & Android 17 x64 accessibles instantanément depuis le lanceur d'applications (Waffle Menu).",
          "Propulsé par les bibliothèques fondamentales YOLO en Rust sans code unsafe et Upstream Bun v1.4.4+.",
        ]
      : [
          "2026 Identity: Dynamic 4-stop gradient (#4285F4 -> #9B72CB -> #D96570 -> #F4B400) fused with Aphrody Gold (#FFD700) and Deep Navy (#17335C).",
          "16 Web & Android 17 x64 applications instantaneously accessible via the 9-dot Aphrody Apps launcher.",
          "Powered by the YOLO core library ecosystem in memory-safe Rust and Upstream Bun v1.4.4+.",
        ],
    citations: [
      { title: "Aphrody Search & AI Hub", url: "https://aphrody.com/search" },
      { title: "Aphrody Workspace (WordCraft, GridCraft, DeckCraft)", url: "https://docs.aphrody.com" },
      { title: "2026 GoogleBook Laptop OS (Aluminium + CrOS + Android 17)", url: "https://os.aphrody.com" },
    ],
  };
}
