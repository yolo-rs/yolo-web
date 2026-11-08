// SPDX-License-Identifier: Apache-2.0
/**
 * Répertoire officiel complet des canaux YouTube, comptes X (Twitter), serveurs Discord,
 * adresses de contact clés et portails majeurs de l'écosystème Google / Alphabet / DeepMind.
 */

export interface GoogleChannelEntry {
  name: string;
  category: "youtube" | "x-twitter" | "discord" | "email" | "portal";
  handleOrId: string;
  url: string;
  description: string;
  priority: "high" | "critical" | "medium";
}

export const GOOGLE_ECOSYSTEM_CHANNELS: GoogleChannelEntry[] = [
  // --- Canaux YouTube Officiels ---
  {
    name: "Google DeepMind",
    category: "youtube",
    handleOrId: "@GoogleDeepMind",
    url: "https://www.youtube.com/@GoogleDeepMind",
    description:
      "Recherche de pointe, annonces Gemini, AlphaFold, architectures de modèles.",
    priority: "critical",
  },
  {
    name: "Google for Developers",
    category: "youtube",
    handleOrId: "@GoogleDevelopers",
    url: "https://www.youtube.com/@GoogleDevelopers",
    description:
      "Google I/O talks, Chromium, Web APIs, Android et conférences techniques mondiales.",
    priority: "critical",
  },
  {
    name: "Google Cloud Tech",
    category: "youtube",
    handleOrId: "@GoogleCloudTech",
    url: "https://www.youtube.com/@GoogleCloudTech",
    description:
      "Architectures Cloud, Kubernetes/GKE, Spanner, BigQuery et Cloud Run.",
    priority: "high",
  },
  {
    name: "Android Developers",
    category: "youtube",
    handleOrId: "@AndroidDevelopers",
    url: "https://www.youtube.com/@AndroidDevelopers",
    description:
      "AOSP, Jetpack Compose, Material Design 3 Expressive et performances ART.",
    priority: "high",
  },
  {
    name: "Chromium",
    category: "youtube",
    handleOrId: "@ChromiumDev",
    url: "https://www.youtube.com/@ChromiumDev",
    description:
      "V8 internals, Blink rendering engine, WebMCP, DevTools et standardisation W3C.",
    priority: "critical",
  },

  // --- Comptes X (Twitter) Officiels ---
  {
    name: "Google DeepMind X",
    category: "x-twitter",
    handleOrId: "@GoogleDeepMind",
    url: "https://x.com/GoogleDeepMind",
    description:
      "Flux en direct des publications scientifiques et releases de recherche.",
    priority: "critical",
  },
  {
    name: "Google Open Source",
    category: "x-twitter",
    handleOrId: "@GoogleOSS",
    url: "https://x.com/GoogleOSS",
    description:
      "Releases des projets open source Google (gVisor, Bazel, Go, Rust, Fuchsia).",
    priority: "high",
  },
  {
    name: "Chromium Developers",
    category: "x-twitter",
    handleOrId: "@ChromiumDev",
    url: "https://x.com/ChromiumDev",
    description:
      "Changelogs en direct de Chrome/Chromium et fonctionnalités DevTools.",
    priority: "critical",
  },
  {
    name: "Jeff Dean",
    category: "x-twitter",
    handleOrId: "@JeffDean",
    url: "https://x.com/JeffDean",
    description: "Chief Scientist chez Google DeepMind & Google Research.",
    priority: "critical",
  },
  {
    name: "Sundar Pichai",
    category: "x-twitter",
    handleOrId: "@sundarpichai",
    url: "https://x.com/sundarpichai",
    description: "CEO Alphabet et Google.",
    priority: "high",
  },

  // --- Serveurs Discord Officiels / Communautés Clés ---
  {
    name: "Google AI Community Discord",
    category: "discord",
    handleOrId: "google-ai",
    url: "https://discord.gg/google-ai",
    description:
      "Discussions développeurs Gemini API, AI Studio et Gemma open weights.",
    priority: "critical",
  },
  {
    name: "Angular & Wiz Discord",
    category: "discord",
    handleOrId: "angular",
    url: "https://discord.gg/angular",
    description:
      "Communauté technique sur l'intégration Angular/Wiz Signals et BOQ.",
    priority: "high",
  },
  {
    name: "Chromium Embedded Framework Discord",
    category: "discord",
    handleOrId: "cef",
    url: "https://discord.gg/cef",
    description: "Intégration Chromium natif et architecture headless.",
    priority: "medium",
  },

  // --- Adresses email stratégiques & Recrutement ---
  {
    name: "Google Paris Engineering Staffing",
    category: "email",
    handleOrId: "paris-eng-hiring@google.com",
    url: "mailto:paris-eng-hiring@google.com",
    description:
      "Contact principal des recruteurs techniques du campus Google Paris (8 rue de Londres).",
    priority: "critical",
  },
  {
    name: "Google Student & New Grad Careers",
    category: "email",
    handleOrId: "google-students@google.com",
    url: "mailto:google-students@google.com",
    description:
      "Programmes nouveaux diplômés, stages et transitions de carrières.",
    priority: "high",
  },
  {
    name: "Google Open Source Office (OSPO)",
    category: "email",
    handleOrId: "opensource@google.com",
    url: "mailto:opensource@google.com",
    description:
      "Relations contributeurs open-source, programmes GSoC et partenariats.",
    priority: "high",
  },
  {
    name: "Google Accessibility Office",
    category: "email",
    handleOrId: "disability-support@google.com",
    url: "mailto:disability-support@google.com",
    description:
      "Support et recherche accessibilité (vision, cécité, Stargardt, Project Relate).",
    priority: "critical",
  },

  // --- Portails Web Majeurs à Forte Valeur ---
  {
    name: "Google Careers Paris Engineering",
    category: "portal",
    handleOrId: "careers-paris",
    url: "https://careers.google.com/locations/paris/",
    description:
      "Offres en génie logiciel L4/L5, Chrome, Cloud et recherche à Paris.",
    priority: "critical",
  },
  {
    name: "Google Open Source Portal",
    category: "portal",
    handleOrId: "opensource-portal",
    url: "https://opensource.google/",
    description:
      "Annuaire exhaustif de tous les dépôts et politiques open source Google.",
    priority: "critical",
  },
  {
    name: "Google Git Source Trees",
    category: "portal",
    handleOrId: "googlesource",
    url: "https://googlesource.com/",
    description:
      "Miroir souverain des sources Gerrit (Chromium, AOSP, Fuchsia, Go, gVisor).",
    priority: "critical",
  },
  {
    name: "Google Research Publications",
    category: "portal",
    handleOrId: "research-pubs",
    url: "https://research.google/pubs/",
    description:
      "Publications scientifiques évaluées par les pairs pour toutes les divisions.",
    priority: "critical",
  },
];
