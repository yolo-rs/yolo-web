// SPDX-License-Identifier: Apache-2.0
/** @jsx h */
/**
 * Hero search box with live suggestions (S01, S02; flows F01, F02).
 *
 * ARIA 1.2 combobox with a listbox popup and list autocomplete: focus stays
 * in the input, `aria-activedescendant` points at the highlighted option.
 * Keys: Down and Up move through the list (and wrap back to what was typed),
 * Enter submits the highlighted row or the typed text, Escape closes the list
 * and then clears the field, Tab closes the list. The typed part of each row
 * is regular weight and the completion is bold.
 */
import { h } from "../../dom.ts";
import { Icon } from "./icons.tsx";
import { expandTemplate } from "../settings.ts";
import { normalizeUrl } from "../shortcuts.ts";
import {
  type Candidate,
  looksLikeUrl,
  rankSuggestions,
  type Suggestion,
} from "../suggest.ts";

export interface SearchBoxOptions {
  /** Current search URL template. */
  readonly searchUrl: () => string;
  /** Local candidates, synchronous (search history, shortcuts). */
  readonly localCandidates: () => readonly Candidate[];
  /** Slower candidates (remote endpoint, browser history). */
  readonly asyncCandidates: (query: string) => Promise<readonly Candidate[]>;
  /** Called with the final query text before navigating. */
  readonly onSubmitQuery: (text: string) => Promise<void> | void;
  /** Optional callback to remove a local history query suggestion. */
  readonly onRemoveQuery?: (text: string) => Promise<void> | void;
  readonly navigate: (url: string) => void;
  /** Host shown in the accessible name ("Search with aphrody.com"). */
  readonly host: () => string;
}

export interface SearchBox {
  readonly node: Node;
  readonly input: HTMLInputElement;
  /** Re-reads the host for the label after a settings change. */
  refreshLabel(): void;
}

let optionSeq = 0;

function renderText(suggestion: Suggestion): Node {
  const span = suggestion.match;
  const text = suggestion.text;
  if (!span) {
    return <span class="yw-option-text">{text}</span>;
  }
  const [start, end] = span;
  return (
    <span class="yw-option-text">
      {start > 0 ? <b>{text.slice(0, start)}</b> : null}
      <span class="yw-option-typed">{text.slice(start, end)}</span>
      {end < text.length ? <b>{text.slice(end)}</b> : null}
    </span>
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function SearchBox(options: SearchBoxOptions): SearchBox {
  let input!: HTMLInputElement;
  let list!: HTMLUListElement;
  let clear!: HTMLButtonElement;
  let status!: HTMLElement;
  let label!: HTMLLabelElement;
  let root!: HTMLFormElement;

  let typed = "";
  let suggestions: Suggestion[] = [];
  let active = -1;
  let requestId = 0;
  let asyncPool: readonly Candidate[] = [];

  const setOpen = (open: boolean): void => {
    list.hidden = !open;
    root.classList.toggle("yw-open", open);
    input.setAttribute("aria-expanded", open ? "true" : "false");
    if (!open) {
      input.removeAttribute("aria-activedescendant");
      active = -1;
    }
  };

  const optionId = (index: number): string => `yw-option-${optionSeq}-${index}`;

  const setActive = (index: number): void => {
    active = index;
    const options = list.querySelectorAll<HTMLElement>('[role="option"]');
    options.forEach((option, i) => {
      option.setAttribute("aria-selected", i === index ? "true" : "false");
    });
    const current = suggestions[index];
    if (index >= 0 && current) {
      input.setAttribute("aria-activedescendant", optionId(index));
      input.value =
        current.kind === "page" && current.url ? current.url : current.text;
      options[index]?.scrollIntoView({ block: "nearest" });
    } else {
      input.removeAttribute("aria-activedescendant");
      input.value = typed;
    }
  };

  const render = (): void => {
    optionSeq++;
    list.replaceChildren(
      ...suggestions.map((suggestion, index) => (
        <li
          id={optionId(index)}
          class="yw-option"
          role="option"
          aria-selected="false"
          onMousedown={(event) => event.preventDefault()}
          onClick={() => choose(index)}
        >
          <span class="yw-option-icon">
            <Icon
              name={
                suggestion.kind === "page"
                  ? "page"
                  : suggestion.kind === "history-query"
                    ? "history"
                    : "search"
              }
            />
          </span>
          {renderText(suggestion)}
          {suggestion.kind === "page" && suggestion.url ? (
            <span class="yw-option-url">{hostOf(suggestion.url)}</span>
          ) : null}
          {suggestion.kind === "history-query" && options.onRemoveQuery ? (
            <button
              type="button"
              class="yw-icon-button"
              aria-label={`Remove ${suggestion.text} from search history`}
              onMousedown={(event) => event.preventDefault()}
              onClick={(event) => {
                event.stopPropagation();
                void Promise.resolve(
                  options.onRemoveQuery!(suggestion.text),
                ).then(() => recompute());
              }}
            >
              <Icon name="close" />
            </button>
          ) : null}
        </li>
      )),
    );
    setOpen(suggestions.length > 0 && document.activeElement === input);
    status.textContent =
      suggestions.length > 0
        ? `${suggestions.length} suggestion${suggestions.length === 1 ? "" : "s"}, use the up and down arrow keys to review.`
        : "";
  };

  const recompute = (): void => {
    suggestions = rankSuggestions(typed, [
      ...options.localCandidates(),
      ...asyncPool,
    ]);
    render();
  };

  const onInput = (): void => {
    typed = input.value;
    clear.hidden = typed === "";
    asyncPool = [];
    recompute();
    const id = ++requestId;
    if (!typed.trim()) {
      return;
    }
    void options.asyncCandidates(typed).then((candidates) => {
      if (id !== requestId) {
        return; // a newer keystroke owns the list
      }
      asyncPool = candidates;
      recompute();
    });
  };

  const submitText = async (text: string, url?: string): Promise<void> => {
    const query = text.trim();
    if (!query && !url) {
      input.focus();
      return;
    }
    setOpen(false);
    if (url) {
      options.navigate(url);
      return;
    }
    if (looksLikeUrl(query)) {
      const normalized = normalizeUrl(query);
      if (normalized.ok) {
        options.navigate(normalized.value);
        return;
      }
    }
    await options.onSubmitQuery(query);
    options.navigate(expandTemplate(options.searchUrl(), query));
  };

  const choose = (index: number): void => {
    const suggestion = suggestions[index];
    if (!suggestion) {
      return;
    }
    input.value = suggestion.text;
    void submitText(
      suggestion.text,
      suggestion.kind === "page" ? suggestion.url : undefined,
    );
  };

  const onKeydown = (event: KeyboardEvent): void => {
    const open = !list.hidden;
    switch (event.key) {
      case "ArrowDown": {
        event.preventDefault();
        if (!open) {
          if (suggestions.length > 0) {
            setOpen(true);
          }
          return;
        }
        setActive(active + 1 >= suggestions.length ? -1 : active + 1);
        return;
      }
      case "ArrowUp": {
        if (!open) {
          return;
        }
        event.preventDefault();
        setActive(active <= -1 ? suggestions.length - 1 : active - 1);
        return;
      }
      case "Escape": {
        if (open) {
          event.preventDefault();
          input.value = typed;
          setOpen(false);
          return;
        }
        if (input.value) {
          event.preventDefault();
          input.value = "";
          typed = "";
          clear.hidden = true;
          suggestions = [];
          render();
        }
        return;
      }
      case "Enter": {
        if (event.isComposing) {
          return;
        }
        event.preventDefault();
        if (open && active >= 0) {
          choose(active);
        } else {
          void submitText(input.value);
        }
        return;
      }
      case "Tab":
        setOpen(false);
        return;
      default:
        return;
    }
  };

  const node = (
    <form
      class="yw-search"
      role="search"
      ref={(element) => (root = element)}
      onSubmit={(event) => {
        event.preventDefault();
        void submitText(input.value);
      }}
    >
      <div class="yw-search-field">
        <Icon name="search" />
        <label
          class="yw-visually-hidden"
          for="yw-query"
          ref={(element) => (label = element)}
        />
        <input
          id="yw-query"
          class="yw-search-input"
          type="text"
          name="q"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded="false"
          aria-controls="yw-suggestions"
          aria-describedby="yw-search-status"
          autocomplete="off"
          spellcheck="false"
          enterkeyhint="search"
          maxlength={512}
          autofocus
          ref={(element) => (input = element)}
          onInput={onInput}
          onKeydown={onKeydown}
          onFocus={() => {
            if (suggestions.length > 0) {
              setOpen(true);
            }
          }}
          onBlur={() => setOpen(false)}
        />
        <button
          type="button"
          class="yw-icon-button"
          aria-label="Clear search"
          hidden
          ref={(element) => (clear = element)}
          onClick={() => {
            input.value = "";
            typed = "";
            clear.hidden = true;
            suggestions = [];
            render();
            input.focus();
          }}
        >
          <Icon name="close" />
        </button>
        <button
          type="submit"
          class="yw-icon-button yw-submit"
          aria-label="Search"
        >
          <Icon name="arrow" />
        </button>
      </div>
      <ul
        id="yw-suggestions"
        class="yw-listbox"
        role="listbox"
        aria-label="Suggestions"
        hidden
        ref={(element) => (list = element)}
      />
      <div
        id="yw-search-status"
        class="yw-visually-hidden"
        aria-live="polite"
        ref={(element) => (status = element)}
      />
    </form>
  );

  const refreshLabel = (): void => {
    const text = `Search with ${options.host()}`;
    label.textContent = text;
    input.placeholder = "What are you looking for?";
  };
  refreshLabel();

  return { node, input, refreshLabel };
}
