// SPDX-License-Identifier: Apache-2.0
/** @jsx h */
/**
 * New tab page (S04) and its flows: search with suggestions (F02), shortcut
 * tiles (F03, F04), the resume card (F06) and the customize panel (S05, F05).
 * Screens never call `chrome.*` directly; they go through the data modules.
 */
import {
  applyAppearance,
  deviceIsDark,
  loadFont,
  watchDevice,
} from "./newtab/appearance.ts";
import {
  clearBackground,
  IMAGE_ERROR_TEXT,
  loadBackground,
  saveBackground,
} from "./newtab/background-image.ts";
import {
  hasHistoryAccess,
  historyCandidates,
  loadTopSites,
  requestHistoryAccess,
  revokeHistoryAccess,
} from "./newtab/browser-data.ts";
import { CustomizePanel } from "./newtab/components/customize-panel.tsx";
import { Icon } from "./newtab/components/icons.tsx";
import { Logo } from "./components/logo.tsx";
import { ResumeCard } from "./newtab/components/resume-card.tsx";
import { SearchBox } from "./newtab/components/search-box.tsx";
import { Shortcuts } from "./newtab/components/shortcuts.tsx";
import { Toaster } from "./newtab/components/toast.tsx";
import { h, mount, mountStyles, rootElement } from "./dom.ts";
import {
  type NtpSettings,
  loadSettings,
  updateSettings,
  watchSettings,
} from "./newtab/settings.ts";
import {
  mostVisited,
  ShortcutStore,
  type Shortcut,
} from "./newtab/shortcuts.ts";
import {
  localArea,
  loadThemeId,
  saveThemeId,
  syncArea,
  watchThemeId,
} from "./storage.ts";
import { buildStyleSheet, VAR } from "./styles.ts";
import {
  type Candidate,
  clearQueries,
  loadQueries,
  queryCandidates,
  type QueryStat,
  recordQuery,
  removeQuery,
  RemoteSuggestions,
  QUERIES_KEY,
  coerceQueries,
} from "./newtab/suggest.ts";
import type { ThemeId } from "./tokens.ts";

function hostOf(template: string): string {
  try {
    return new URL(template.replace("{searchTerms}", "")).host.replace(
      /^www\./,
      "",
    );
  } catch {
    return "the web";
  }
}

async function main(): Promise<void> {
  mountStyles(buildStyleSheet());
  const sync = syncArea();
  const local = localArea();
  const store = new ShortcutStore(sync);
  const remote = new RemoteSuggestions();

  let settings: NtpSettings = await loadSettings(sync);
  let themeId: ThemeId = await loadThemeId(sync);
  let deviceDark = deviceIsDark();
  let historyGranted = await hasHistoryAccess();
  let queries: QueryStat[] = await loadQueries(local);
  let shortcutPool: Shortcut[] = [];
  let backgroundUrl: string | undefined;

  applyAppearance(themeId, settings, deviceDark);
  document.title = "New tab";
  void loadFont();

  const navigate = (url: string): void => {
    window.location.assign(url);
  };

  let liveRegion!: HTMLElement;
  const announce = (message: string): void => {
    liveRegion.textContent = "";
    window.setTimeout(() => (liveRegion.textContent = message), 50);
  };

  const toaster = Toaster();

  const refreshShortcutPool = async (): Promise<void> => {
    const [mine, top] = await Promise.all([
      store.list(),
      loadTopSites().then(async (sites) =>
        mostVisited(sites, await store.hiddenTop()),
      ),
    ]);
    shortcutPool = [...mine, ...top];
  };

  const search = SearchBox({
    searchUrl: () => settings.searchUrl,
    host: () => hostOf(settings.searchUrl),
    localCandidates: (): Candidate[] => [
      ...queryCandidates(queries),
      ...shortcutPool.map((item): Candidate => ({
        kind: "page",
        text: item.title,
        url: item.url,
        source: "shortcuts",
        count: 3,
        last: Date.now(),
      })),
    ],
    asyncCandidates: async (query) => {
      const [fromRemote, fromHistory] = await Promise.all([
        remote.fetch(settings.suggestUrl, query),
        historyGranted ? historyCandidates(query) : Promise.resolve([]),
      ]);
      return [...fromRemote, ...fromHistory];
    },
    onSubmitQuery: async (text) => {
      await recordQuery(local, text);
    },
    onRemoveQuery: async (text) => {
      await removeQuery(local, text);
      queries = await loadQueries(local);
      announce(`Removed ${text} from search history.`);
    },
    navigate,
  });

  const shortcuts = Shortcuts({
    store,
    toaster,
    announce,
    navigate,
    loadTop: async () =>
      mostVisited(await loadTopSites(), await store.hiddenTop()),
    switchMode: (mode) => void updateSettings(sync, { shortcutsMode: mode }),
  });

  const resume = ResumeCard({
    navigate,
    hide: () => {
      void updateSettings(sync, { cardsVisible: { resume: false } });
      toaster.show("Card hidden. Turn it back on in Customize.");
    },
    onAccessChange: (granted) => {
      historyGranted = granted;
      syncPanel();
    },
  });

  const panel = CustomizePanel({
    setTheme: (id) => void saveThemeId(id, sync),
    patch: (patch) => void updateSettings(sync, patch),
    setBackground: async (file) => {
      const problem = await saveBackground(file);
      if (problem) {
        return IMAGE_ERROR_TEXT[problem];
      }
      // A new stamp makes every open tab reload the image.
      await updateSettings(sync, {
        background: "image",
        backgroundStamp: Date.now(),
      });
      return undefined;
    },
    clearBackground: () => {
      void clearBackground().then(() =>
        updateSettings(sync, { background: "none" }),
      );
    },
    clearSearchHistory: async () => {
      await clearQueries(local);
      queries = [];
    },
    restoreHiddenSites: async () => {
      await store.clearHiddenTop();
      await shortcuts.refresh(settings.shortcutsMode);
      announce("Removed sites restored.");
    },
    revokeHistory: async () => {
      await revokeHistoryAccess();
      historyGranted = await hasHistoryAccess();
      syncPanel();
      if (settings.cardsVisible.resume) {
        void resume.refresh();
      }
    },
    requestHistory: async () => {
      historyGranted = await requestHistoryAccess();
      syncPanel();
      void resume.refresh();
      return historyGranted;
    },
    announce,
  });

  const syncPanel = (): void =>
    panel.sync({ themeId, settings, historyGranted, deviceDark });

  let footer!: HTMLElement;
  let footerHost!: HTMLAnchorElement;
  let shortcutsSlot!: HTMLElement;
  let resumeSlot!: HTMLElement;
  let customizeButton!: HTMLButtonElement;

  const page = (
    <div>
      <a href="#yw-query" class="yw-visually-hidden" style="position: absolute; left: -9999px; top: 8px; z-index: 9999; padding: 8px 12px; background: var(--yw-color-primary, #1a73e8); color: #fff; border-radius: 6px; text-decoration: none;">Skip to search</a>
      <main class="yw-page">
        <h1 class="yw-brand">
          <Logo size={48} id="newtab" />
          <span>Aphrody</span>
        </h1>
        {search.node}
        <div class="yw-slot" ref={(el) => (shortcutsSlot = el)}>
          {shortcuts.node}
        </div>
        <div class="yw-slot" ref={(el) => (resumeSlot = el)}>
          {resume.node}
        </div>
      </main>
      <footer class="yw-footer" ref={(el) => (footer = el)}>
        Searches go to{" "}
        <a ref={(el) => (footerHost = el)} href="https://aphrody.com/" />.
        Shortcuts, history and settings stay in this browser profile.
      </footer>
      <button
        type="button"
        class="yw-button yw-customize"
        ref={(el) => (customizeButton = el)}
        onClick={() => {
          syncPanel();
          panel.open(customizeButton);
        }}
      >
        <Icon name="customize" />
        Customize
      </button>
      {panel.node}
      {toaster.node}
      <div
        class="yw-visually-hidden"
        aria-live="polite"
        ref={(el) => (liveRegion = el)}
      />
    </div>
  );

  const applyBackground = async (): Promise<void> => {
    const body = document.body;
    if (backgroundUrl) {
      URL.revokeObjectURL(backgroundUrl);
      backgroundUrl = undefined;
    }
    const blob =
      settings.background === "image" ? await loadBackground() : undefined;
    if (blob) {
      backgroundUrl = URL.createObjectURL(blob);
      body.style.setProperty(VAR.backgroundImage, `url("${backgroundUrl}")`);
      body.classList.add("yw-has-image");
    } else {
      body.style.removeProperty(VAR.backgroundImage);
      body.classList.remove("yw-has-image");
    }
  };

  const render = async (previous?: NtpSettings): Promise<void> => {
    applyAppearance(themeId, settings, deviceDark);
    search.refreshLabel();
    footer.hidden = !settings.footerVisible;
    footerHost.href =
      new URL(settings.searchUrl.replace("{searchTerms}", "")).origin + "/";
    footerHost.textContent = hostOf(settings.searchUrl);
    shortcutsSlot.hidden = !settings.shortcutsVisible;
    resumeSlot.hidden = !settings.cardsVisible.resume;
    if (
      !previous ||
      previous.background !== settings.background ||
      previous.backgroundStamp !== settings.backgroundStamp
    ) {
      await applyBackground();
    }
    if (!previous || previous.shortcutsMode !== settings.shortcutsMode) {
      await shortcuts.refresh(settings.shortcutsMode);
    }
    if (
      settings.cardsVisible.resume &&
      (!previous || !previous.cardsVisible.resume)
    ) {
      await resume.refresh();
    }
    syncPanel();
  };

  mount(rootElement(), page);
  await refreshShortcutPool();
  await render();
  search.input.focus();

  watchSettings(sync, (next) => {
    const previous = settings;
    settings = next;
    void render(previous);
  });
  watchThemeId((id) => {
    themeId = id;
    void render(settings);
  }, sync);
  watchDevice((dark) => {
    deviceDark = dark;
    void render(settings);
  });
  sync.watch((changes) => {
    if ("ntp.shortcuts" in changes || "ntp.hiddenTop" in changes) {
      void refreshShortcutPool();
      void shortcuts.refresh(settings.shortcutsMode);
    }
  });
  local.watch((changes) => {
    if (QUERIES_KEY in changes) {
      queries = coerceQueries(changes[QUERIES_KEY]);
    }
  });
}

void main();
