// SPDX-License-Identifier: Apache-2.0
/** @jsx h */
/**
 * Customize side panel (S05, flow F05). A modal `<dialog>` docked to the
 * right edge: focus moves into it, Escape and the close button dismiss it and
 * focus returns to the Customize button. Every control writes straight to
 * storage; the page redraws from the storage change, so two open tabs and the
 * toolbar popup stay in step.
 */
import { IMAGE_ERROR_TEXT, ACCEPTED_TYPES } from "../background-image.ts";
import { h } from "../../dom.ts";
import { rolesFor } from "../scheme.ts";
import {
  DEFAULT_SEARCH_URL,
  EXAMPLE_SUGGEST_URL,
  isUrlTemplate,
  type Mode,
  type NtpSettings,
  type ShortcutsMode,
} from "../settings.ts";
import { SWATCH_ON_PROPERTY, SWATCH_PROPERTY } from "../../styles.ts";
import { SEED_SWATCHES, THEMES, type ThemeId } from "../../tokens.ts";
import { Icon } from "./icons.tsx";

export interface PanelState {
  readonly themeId: ThemeId;
  readonly settings: NtpSettings;
  readonly historyGranted: boolean;
  readonly deviceDark: boolean;
}

export interface PanelActions {
  setTheme(id: ThemeId): void;
  patch(patch: Partial<NtpSettings>): void;
  /** Resolves to an error message, or `undefined` when stored. */
  setBackground(file: File): Promise<string | undefined>;
  clearBackground(): void;
  clearSearchHistory(): Promise<void>;
  restoreHiddenSites(): Promise<void>;
  revokeHistory(): Promise<void>;
  requestHistory(): Promise<boolean>;
  announce(message: string): void;
}

export interface CustomizePanel {
  readonly node: Node;
  open(opener: HTMLElement): void;
  sync(state: PanelState): void;
}

let groupSeq = 0;

/** A visually styled radio, labelled by its text. */
function Choice(props: {
  name: string;
  value: string;
  label: string;
  onPick: (value: string) => void;
  swatch?: { color: string; on: string };
  ref?: (input: HTMLInputElement) => void;
}): Node {
  return (
    <label class="yw-choice">
      <input
        type="radio"
        name={props.name}
        value={props.value}
        ref={props.ref}
        onChange={() => props.onPick(props.value)}
      />
      {props.swatch ? (
        <span
          class="yw-preset-swatch"
          aria-hidden="true"
          ref={(el) => {
            el.style.setProperty(SWATCH_PROPERTY, props.swatch!.color);
            el.style.setProperty(SWATCH_ON_PROPERTY, props.swatch!.on);
          }}
        />
      ) : null}
      <span>{props.label}</span>
    </label>
  );
}

function Switch(props: {
  id: string;
  label: string;
  onToggle: (checked: boolean) => void;
  ref: (input: HTMLInputElement) => void;
}): Node {
  return (
    <div class="yw-row">
      <label for={props.id}>{props.label}</label>
      <input
        id={props.id}
        class="yw-switch"
        type="checkbox"
        role="switch"
        ref={props.ref}
        onChange={(event) =>
          props.onToggle((event.target as HTMLInputElement).checked)
        }
      />
    </div>
  );
}

export function CustomizePanel(actions: PanelActions): CustomizePanel {
  const id = `yw-panel-${++groupSeq}`;
  let dialog!: HTMLDialogElement;
  let opener: HTMLElement | undefined;
  const themeInputs = new Map<ThemeId, HTMLInputElement>();
  const seedInputs = new Map<string, HTMLInputElement>();
  const modeInputs = new Map<Mode, HTMLInputElement>();
  const shortcutModeInputs = new Map<ShortcutsMode, HTMLInputElement>();
  const backgroundInputs = new Map<"none" | "image", HTMLInputElement>();
  let colorGroup!: HTMLFieldSetElement;
  let colorNote!: HTMLElement;
  let modeGroup!: HTMLFieldSetElement;
  let modeNote!: HTMLElement;
  let customColor!: HTMLInputElement;
  let fileInput!: HTMLInputElement;
  let imageError!: HTMLElement;
  let shortcutsSwitch!: HTMLInputElement;
  let shortcutsModeGroup!: HTMLFieldSetElement;
  let restoreButton!: HTMLButtonElement;
  let resumeSwitch!: HTMLInputElement;
  let historyNote!: HTMLElement;
  let revokeButton!: HTMLButtonElement;
  let footerSwitch!: HTMLInputElement;
  let searchUrlInput!: HTMLInputElement;
  let suggestUrlInput!: HTMLInputElement;
  let searchError!: HTMLElement;
  let current: PanelState | undefined;

  const pickImage = (): void => fileInput.click();

  const saveSearch = (): void => {
    const searchUrl = searchUrlInput.value.trim() || DEFAULT_SEARCH_URL;
    const suggestUrl = suggestUrlInput.value.trim();
    const problems: string[] = [];
    if (!isUrlTemplate(searchUrl)) {
      problems.push(
        "The search address must start with https:// and contain {searchTerms} once.",
      );
    }
    if (suggestUrl !== "" && !isUrlTemplate(suggestUrl)) {
      problems.push(
        "The suggestion address must start with https:// and contain {searchTerms} once, or be empty.",
      );
    }
    searchError.textContent = problems.join(" ");
    searchError.hidden = problems.length === 0;
    searchUrlInput.toggleAttribute("aria-invalid", !isUrlTemplate(searchUrl));
    suggestUrlInput.toggleAttribute(
      "aria-invalid",
      suggestUrl !== "" && !isUrlTemplate(suggestUrl),
    );
    if (problems.length === 0) {
      actions.patch({ searchUrl, suggestUrl });
      actions.announce("Search settings saved.");
    }
  };

  const node = (
    <dialog
      class="yw-panel"
      aria-labelledby={`${id}-title`}
      ref={(el) => (dialog = el)}
      onClose={() => opener?.focus()}
      onClick={(event) => {
        // A click on the backdrop lands on the dialog element itself.
        if (event.target === dialog) {
          dialog.close();
        }
      }}
    >
      <div class="yw-panel-header">
        <h2 id={`${id}-title`} class="yw-panel-title">
          Customize this page
        </h2>
        <button
          type="button"
          class="yw-icon-button"
          aria-label="Close"
          onClick={() => dialog.close()}
        >
          <Icon name="close" />
        </button>
      </div>
      <div class="yw-panel-body">
        <fieldset class="yw-group">
          <legend>Theme</legend>
          <div class="yw-presets">
            {THEMES.map((theme) => {
              const sample = rolesFor(
                theme,
                SEED_SWATCHES[0]!.hex,
                theme.scheme ?? "light",
              );
              return (
                <Choice
                  name={`${id}-theme`}
                  value={theme.id}
                  label={theme.label}
                  swatch={{ color: sample.surface, on: sample.primary }}
                  ref={(input) => themeInputs.set(theme.id, input)}
                  onPick={(value) => actions.setTheme(value as ThemeId)}
                />
              );
            })}
          </div>
          <p class="yw-note">
            Brand themes match yolo-chromium started with the same --theme name.
          </p>
        </fieldset>

        <fieldset class="yw-group" ref={(el) => (colorGroup = el)}>
          <legend>Color seed</legend>
          <div class="yw-seeds">
            {SEED_SWATCHES.map((swatch) => (
              <label class="yw-seed" title={swatch.label}>
                <input
                  type="radio"
                  name={`${id}-seed`}
                  value={swatch.hex}
                  aria-label={swatch.label}
                  ref={(input) => seedInputs.set(swatch.hex, input)}
                  onChange={() => actions.patch({ seed: swatch.hex })}
                />
                <span
                  aria-hidden="true"
                  ref={(el) =>
                    el.style.setProperty(SWATCH_PROPERTY, swatch.hex)
                  }
                />
              </label>
            ))}
            <input
              class="yw-color-input"
              type="color"
              aria-label="Custom color"
              ref={(el) => (customColor = el)}
              onChange={() => actions.patch({ seed: customColor.value })}
            />
          </div>
          <p class="yw-note" ref={(el) => (colorNote = el)} />
        </fieldset>

        <fieldset class="yw-group" ref={(el) => (modeGroup = el)}>
          <legend>Light and dark</legend>
          <div class="yw-segmented">
            {(
              [
                ["device", "Device"],
                ["light", "Light"],
                ["dark", "Dark"],
              ] as const
            ).map(([value, label]) => (
              <Choice
                name={`${id}-mode`}
                value={value}
                label={label}
                ref={(input) => modeInputs.set(value, input)}
                onPick={(picked) => actions.patch({ mode: picked as Mode })}
              />
            ))}
          </div>
          <p class="yw-note" ref={(el) => (modeNote = el)} />
        </fieldset>

        <fieldset class="yw-group">
          <legend>Background</legend>
          <div class="yw-segmented">
            <Choice
              name={`${id}-bg`}
              value="none"
              label="None"
              ref={(input) => backgroundInputs.set("none", input)}
              onPick={() => actions.clearBackground()}
            />
            <Choice
              name={`${id}-bg`}
              value="image"
              label="My image"
              ref={(input) => backgroundInputs.set("image", input)}
              onPick={pickImage}
            />
          </div>
          <div class="yw-row">
            <span class="yw-note">
              PNG, JPEG, WebP, AVIF or GIF, up to 8 MB. Stays in this browser.
            </span>
            <button type="button" class="yw-button" onClick={pickImage}>
              <Icon name="image" />
              Choose image
            </button>
          </div>
          <input
            class="yw-visually-hidden"
            type="file"
            accept={ACCEPTED_TYPES.join(",")}
            tabindex={-1}
            aria-hidden="true"
            ref={(el) => (fileInput = el)}
            onChange={() => {
              const file = fileInput.files?.[0];
              fileInput.value = "";
              if (!file) {
                return;
              }
              void actions.setBackground(file).then((problem) => {
                imageError.textContent = problem ?? "";
                imageError.hidden = !problem;
                if (problem) {
                  actions.announce(problem);
                } else {
                  actions.announce("Background image set.");
                }
              });
            }}
          />
          <p
            class="yw-error"
            role="alert"
            hidden
            ref={(el) => (imageError = el)}
          />
        </fieldset>

        <fieldset class="yw-group">
          <legend>Shortcuts</legend>
          <Switch
            id={`${id}-shortcuts`}
            label="Show shortcuts"
            ref={(el) => (shortcutsSwitch = el)}
            onToggle={(checked) => actions.patch({ shortcutsVisible: checked })}
          />
          <fieldset class="yw-group" ref={(el) => (shortcutsModeGroup = el)}>
            <legend class="yw-visually-hidden">Which shortcuts</legend>
            <div class="yw-segmented">
              <Choice
                name={`${id}-smode`}
                value="mine"
                label="My shortcuts"
                ref={(input) => shortcutModeInputs.set("mine", input)}
                onPick={() => actions.patch({ shortcutsMode: "mine" })}
              />
              <Choice
                name={`${id}-smode`}
                value="top"
                label="Most visited"
                ref={(input) => shortcutModeInputs.set("top", input)}
                onPick={() => actions.patch({ shortcutsMode: "top" })}
              />
            </div>
          </fieldset>
          <div class="yw-row">
            <span class="yw-note">
              Bring back most visited sites you removed.
            </span>
            <button
              type="button"
              class="yw-button"
              ref={(el) => (restoreButton = el)}
              onClick={() => void actions.restoreHiddenSites()}
            >
              Restore
            </button>
          </div>
        </fieldset>

        <fieldset class="yw-group">
          <legend>Cards</legend>
          <Switch
            id={`${id}-resume`}
            label="Opened today"
            ref={(el) => (resumeSwitch = el)}
            onToggle={(checked) => {
              actions.patch({ cardsVisible: { resume: checked } });
              if (checked && current && !current.historyGranted) {
                void actions.requestHistory();
              }
            }}
          />
          <div class="yw-row">
            <span class="yw-note" ref={(el) => (historyNote = el)} />
            <button
              type="button"
              class="yw-button"
              ref={(el) => (revokeButton = el)}
              onClick={() => void actions.revokeHistory()}
            >
              Turn off
            </button>
          </div>
        </fieldset>

        <fieldset class="yw-group">
          <legend>Footer</legend>
          <Switch
            id={`${id}-footer`}
            label="Show footer"
            ref={(el) => (footerSwitch = el)}
            onToggle={(checked) => actions.patch({ footerVisible: checked })}
          />
        </fieldset>

        <form
          class="yw-group"
          novalidate
          onSubmit={(event) => {
            event.preventDefault();
            saveSearch();
          }}
        >
          <h3 class="yw-group-title">Search</h3>
          <div class="yw-field">
            <label for={`${id}-search-url`}>
              Search address, with {"{searchTerms}"}
            </label>
            <input
              id={`${id}-search-url`}
              class="yw-input"
              type="text"
              inputmode="url"
              spellcheck="false"
              aria-describedby={`${id}-search-error`}
              ref={(el) => (searchUrlInput = el)}
            />
          </div>
          <div class="yw-field">
            <label for={`${id}-suggest-url`}>
              Suggestion service (empty for this device only)
            </label>
            <input
              id={`${id}-suggest-url`}
              class="yw-input"
              type="text"
              inputmode="url"
              spellcheck="false"
              placeholder={EXAMPLE_SUGGEST_URL}
              aria-describedby={`${id}-search-error`}
              ref={(el) => (suggestUrlInput = el)}
            />
          </div>
          <p
            id={`${id}-search-error`}
            class="yw-error"
            hidden
            ref={(el) => (searchError = el)}
          />
          <div class="yw-dialog-actions">
            <button type="submit" class="yw-button yw-button-primary">
              Save
            </button>
            <button
              type="button"
              class="yw-button yw-button-text"
              onClick={() => {
                void actions
                  .clearSearchHistory()
                  .then(() =>
                    actions.announce("Search history on this device cleared."),
                  );
              }}
            >
              Clear search history
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );

  const sync = (state: PanelState): void => {
    current = state;
    const { settings, themeId } = state;
    const theme = THEMES.find((candidate) => candidate.id === themeId);
    themeInputs.get(themeId)!.checked = true;
    const seedTheme = themeId === "default";
    colorGroup.disabled = !seedTheme;
    colorNote.textContent = seedTheme
      ? "Every color on the page is derived from this one."
      : "Brand themes use their own colors. Pick Color seed to use yours.";
    for (const [hex, input] of seedInputs) {
      input.checked = hex === settings.seed;
    }
    customColor.value = settings.seed;
    const fixedScheme = theme?.scheme;
    modeGroup.disabled = fixedScheme !== undefined;
    modeNote.textContent = fixedScheme
      ? `${theme?.label} is a ${fixedScheme} theme.`
      : settings.mode === "device"
        ? `Following the device, now ${state.deviceDark ? "dark" : "light"}.`
        : "";
    modeInputs.get(settings.mode)!.checked = true;
    backgroundInputs.get(settings.background)!.checked = true;
    shortcutsSwitch.checked = settings.shortcutsVisible;
    shortcutsModeGroup.disabled = !settings.shortcutsVisible;
    shortcutModeInputs.get(settings.shortcutsMode)!.checked = true;
    restoreButton.disabled = settings.shortcutsMode !== "top";
    resumeSwitch.checked = settings.cardsVisible.resume;
    historyNote.textContent = state.historyGranted
      ? "History access is on. It also adds page titles to suggestions."
      : "History access is off.";
    revokeButton.hidden = !state.historyGranted;
    footerSwitch.checked = settings.footerVisible;
    if (document.activeElement !== searchUrlInput) {
      searchUrlInput.value = settings.searchUrl;
    }
    if (document.activeElement !== suggestUrlInput) {
      suggestUrlInput.value = settings.suggestUrl;
    }
  };

  return {
    node,
    sync,
    open(from) {
      opener = from;
      imageError.hidden = true;
      searchError.hidden = true;
      dialog.showModal();
      dialog.querySelector<HTMLElement>(".yw-icon-button")?.focus();
    },
  };
}
