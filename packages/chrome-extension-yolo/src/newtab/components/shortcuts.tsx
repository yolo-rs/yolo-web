// SPDX-License-Identifier: Apache-2.0
/** @jsx h */
/**
 * Shortcut tiles (S04, S06; flows F03, F04): my shortcuts or most visited,
 * an options menu per tile, the add and edit dialog, removal with an undo
 * toast, and reordering by drag or from the menu ("Move left", "Move right")
 * so no action needs a dragging movement (WCAG 2.2 SC 2.5.7).
 */
import { faviconUrl } from "../browser-data.ts";
import { h } from "../../dom.ts";
import type { ShortcutsMode } from "../settings.ts";
import {
  MAX_SHORTCUTS,
  MAX_TITLE_LENGTH,
  SHORTCUT_ERROR_TEXT,
  type Shortcut,
  type ShortcutStore,
} from "../shortcuts.ts";
import { Icon, type IconName } from "./icons.tsx";
import type { Toaster } from "./toast.tsx";

export interface ShortcutsOptions {
  readonly store: ShortcutStore;
  readonly toaster: Toaster;
  readonly announce: (message: string) => void;
  readonly navigate: (url: string) => void;
  /** Most visited sites minus hidden ones. */
  readonly loadTop: () => Promise<Shortcut[]>;
  readonly switchMode: (mode: ShortcutsMode) => void;
}

export interface ShortcutsView {
  readonly node: Node;
  /** Re-reads the data for `mode` and redraws. */
  refresh(mode: ShortcutsMode): Promise<void>;
}

interface MenuItem {
  readonly label: string;
  readonly icon: IconName;
  readonly disabled?: boolean;
  readonly run: () => void;
}

function monogram(title: string): string {
  const letter = [...title.trim()][0] ?? "?";
  return letter.toLocaleUpperCase();
}

/** Tile icon: the browser's cached favicon, the monogram if there is none. */
function TileIcon(props: { url: string; title: string }): Node {
  const src = faviconUrl(props.url, 32);
  let well!: HTMLElement;
  const node = (
    <span class="yw-tile-well" aria-hidden="true" ref={(el) => (well = el)}>
      {src ? (
        <img
          src={src}
          alt=""
          width={24}
          height={24}
          decoding="async"
          onError={() => well.replaceChildren(monogram(props.title))}
        />
      ) : (
        monogram(props.title)
      )}
    </span>
  );
  return node;
}

export function Shortcuts(options: ShortcutsOptions): ShortcutsView {
  const { store, toaster, announce } = options;
  let section!: HTMLElement;
  let grid!: HTMLOListElement;
  let hint!: HTMLElement;
  let menu!: HTMLElement;
  let dialog!: HTMLDialogElement;
  let dialogTitle!: HTMLElement;
  let nameInput!: HTMLInputElement;
  let urlInput!: HTMLInputElement;
  let errorText!: HTMLElement;
  let removeButton!: HTMLButtonElement;

  let mode: ShortcutsMode = "top";
  let items: Shortcut[] = [];
  let editing: Shortcut | undefined;
  let menuOwner: HTMLButtonElement | undefined;
  let dragId: string | undefined;

  // ------------------------------------------------------------- the menu

  const closeMenu = (restoreFocus: boolean): void => {
    if (menu.matches(":popover-open")) {
      menu.hidePopover();
    }
    menuOwner?.setAttribute("aria-expanded", "false");
    if (restoreFocus) {
      menuOwner?.focus();
    }
    menuOwner = undefined;
  };

  const openMenu = (owner: HTMLButtonElement, entries: MenuItem[]): void => {
    closeMenu(false);
    menuOwner = owner;
    menu.replaceChildren(
      ...entries.map((entry) => (
        <button
          type="button"
          class="yw-menu-item"
          role="menuitem"
          tabindex={-1}
          disabled={entry.disabled ?? false}
          onClick={() => {
            closeMenu(true);
            entry.run();
          }}
        >
          <Icon name={entry.icon} />
          {entry.label}
        </button>
      )),
    );
    menu.showPopover();
    const rect = owner.getBoundingClientRect();
    const width = menu.offsetWidth;
    const left = Math.min(
      window.innerWidth - width - 8,
      Math.max(8, rect.right - width),
    );
    const below = rect.bottom + 4;
    const top =
      below + menu.offsetHeight > window.innerHeight - 8
        ? Math.max(8, rect.top - menu.offsetHeight - 4)
        : below;
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
    owner.setAttribute("aria-expanded", "true");
    menu
      .querySelector<HTMLButtonElement>(".yw-menu-item:not(:disabled)")
      ?.focus();
  };

  const onMenuKeydown = (event: KeyboardEvent): void => {
    const entries = [
      ...menu.querySelectorAll<HTMLButtonElement>(
        ".yw-menu-item:not(:disabled)",
      ),
    ];
    const index = entries.indexOf(document.activeElement as HTMLButtonElement);
    const focusAt = (i: number) =>
      entries[(i + entries.length) % entries.length]?.focus();
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        focusAt(index + 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        focusAt(index - 1);
        break;
      case "Home":
        event.preventDefault();
        focusAt(0);
        break;
      case "End":
        event.preventDefault();
        focusAt(entries.length - 1);
        break;
      case "Escape":
        event.preventDefault();
        closeMenu(true);
        break;
      case "Tab":
        closeMenu(false);
        break;
      default:
        break;
    }
  };

  // ---------------------------------------------------------- the dialog

  const showError = (message: string | undefined): void => {
    errorText.textContent = message ?? "";
    errorText.hidden = !message;
    if (message) {
      urlInput.setAttribute("aria-invalid", "true");
    } else {
      urlInput.removeAttribute("aria-invalid");
    }
  };

  const openDialog = (shortcut?: Shortcut): void => {
    editing = shortcut;
    dialogTitle.textContent = shortcut ? "Edit shortcut" : "Add a shortcut";
    nameInput.value = shortcut?.title ?? "";
    urlInput.value = shortcut?.url ?? "";
    removeButton.hidden = !shortcut;
    showError(undefined);
    dialog.showModal();
    (shortcut ? nameInput : urlInput).focus();
  };

  const saveDialog = async (): Promise<void> => {
    const result = editing
      ? await store.update(editing.id, nameInput.value, urlInput.value)
      : await store.add(nameInput.value, urlInput.value);
    if (!result.ok) {
      showError(SHORTCUT_ERROR_TEXT[result.error]);
      urlInput.focus();
      return;
    }
    const verb = editing ? "Saved" : "Added";
    dialog.close();
    await refresh("mine");
    announce(`${verb} shortcut ${nameInput.value || urlInput.value}.`);
  };

  // ------------------------------------------------------------- actions

  const remove = async (shortcut: Shortcut): Promise<void> => {
    if (mode === "mine") {
      const result = await store.remove(shortcut.id);
      if (!result.ok) {
        return;
      }
      await refresh(mode);
      grid.querySelector<HTMLElement>(".yw-tile-link,.yw-tile-add")?.focus();
      toaster.show(`Removed ${shortcut.title}.`, {
        label: "Undo",
        run: () =>
          void store.restore(result.value).then(async () => {
            await refresh(mode);
            announce(`Restored ${shortcut.title}.`);
          }),
      });
      return;
    }
    await store.hideTop(shortcut.url);
    await refresh(mode);
    grid.querySelector<HTMLElement>(".yw-tile-link")?.focus();
    toaster.show(`${shortcut.title} will not be shown.`, {
      label: "Undo",
      run: () =>
        void store.unhideTop(shortcut.url).then(async () => {
          await refresh(mode);
          announce(`${shortcut.title} is back.`);
        }),
    });
  };

  const move = async (shortcut: Shortcut, to: number): Promise<void> => {
    await store.move(shortcut.id, to);
    await refresh(mode);
    const position = items.findIndex((item) => item.id === shortcut.id);
    announce(
      `Moved ${shortcut.title} to position ${position + 1} of ${items.length}.`,
    );
    grid
      .querySelector<HTMLButtonElement>(
        `[data-id="${CSS.escape(shortcut.id)}"] .yw-tile-menu-button`,
      )
      ?.focus();
  };

  const menuFor = (shortcut: Shortcut, index: number): MenuItem[] =>
    mode === "mine"
      ? [
          {
            label: "Edit shortcut",
            icon: "edit",
            run: () => openDialog(shortcut),
          },
          {
            label: "Move left",
            icon: "left",
            disabled: index === 0,
            run: () => void move(shortcut, index - 1),
          },
          {
            label: "Move right",
            icon: "right",
            disabled: index === items.length - 1,
            run: () => void move(shortcut, index + 1),
          },
          { label: "Remove", icon: "remove", run: () => void remove(shortcut) },
        ]
      : [
          {
            label: "Don't show this site",
            icon: "remove",
            run: () => void remove(shortcut),
          },
        ];

  // --------------------------------------------------------------- tiles

  const clearDropMarks = (): void => {
    grid
      .querySelectorAll(".yw-drop-before,.yw-drop-after")
      .forEach((el) => el.classList.remove("yw-drop-before", "yw-drop-after"));
  };

  const tile = (shortcut: Shortcut, index: number): Node => {
    let menuButton!: HTMLButtonElement;
    const draggable = mode === "mine";
    return (
      <li
        class="yw-tile"
        data-id={shortcut.id}
        draggable={draggable ? "true" : "false"}
        onDragstart={(event) => {
          if (!draggable || !event.dataTransfer) {
            return;
          }
          dragId = shortcut.id;
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/uri-list", shortcut.url);
          (event.currentTarget as HTMLElement).classList.add("yw-dragging");
        }}
        onDragend={(event) => {
          dragId = undefined;
          (event.currentTarget as HTMLElement).classList.remove("yw-dragging");
          clearDropMarks();
        }}
        onDragover={(event) => {
          if (!dragId || dragId === shortcut.id) {
            return;
          }
          event.preventDefault();
          const target = event.currentTarget as HTMLElement;
          const rect = target.getBoundingClientRect();
          const after = event.clientX > rect.left + rect.width / 2;
          clearDropMarks();
          target.classList.add(after ? "yw-drop-after" : "yw-drop-before");
        }}
        onDragleave={(event) => {
          (event.currentTarget as HTMLElement).classList.remove(
            "yw-drop-before",
            "yw-drop-after",
          );
        }}
        onDrop={(event) => {
          if (!dragId || dragId === shortcut.id) {
            return;
          }
          event.preventDefault();
          const target = event.currentTarget as HTMLElement;
          const after = target.classList.contains("yw-drop-after");
          const from = items.findIndex((item) => item.id === dragId);
          const dragged = items[from];
          clearDropMarks();
          if (!dragged) {
            return;
          }
          let to = after ? index + 1 : index;
          if (from < to) {
            to -= 1;
          }
          void move(dragged, to);
        }}
      >
        <a
          class="yw-tile-link"
          href={shortcut.url}
          draggable="false"
          onClick={(event) => {
            if (
              event.button !== 0 ||
              event.ctrlKey ||
              event.metaKey ||
              event.shiftKey
            ) {
              return;
            }
            event.preventDefault();
            options.navigate(shortcut.url);
          }}
        >
          <TileIcon url={shortcut.url} title={shortcut.title} />
          <span class="yw-tile-title">{shortcut.title}</span>
        </a>
        <button
          type="button"
          class="yw-icon-button yw-tile-menu-button"
          aria-label={`Options for ${shortcut.title}`}
          aria-haspopup="menu"
          aria-expanded="false"
          ref={(element) => (menuButton = element)}
          onClick={() => {
            if (menuOwner === menuButton) {
              closeMenu(true);
              return;
            }
            openMenu(menuButton, menuFor(shortcut, index));
          }}
        >
          <Icon name="more" />
        </button>
      </li>
    );
  };

  const draw = (): void => {
    const tiles: Node[] = items.map((item, index) => tile(item, index));
    if (mode === "mine" && items.length < MAX_SHORTCUTS) {
      tiles.push(
        <li>
          <button
            type="button"
            class="yw-tile-add"
            onClick={() => openDialog()}
          >
            <span class="yw-tile-well" aria-hidden="true">
              <Icon name="plus" size={24} />
            </span>
            <span class="yw-tile-title">Add shortcut</span>
          </button>
        </li>,
      );
    }
    grid.replaceChildren(...tiles);
    if (mode === "mine" && items.length === 0) {
      hint.replaceChildren("Pin the sites you open every day.");
      hint.hidden = false;
    } else if (mode === "top" && items.length === 0) {
      hint.replaceChildren(
        "Sites you visit often will appear here. ",
        <button type="button" onClick={() => options.switchMode("mine")}>
          Pick your own instead
        </button>,
      );
      hint.hidden = false;
    } else {
      hint.hidden = true;
    }
  };

  const refresh = async (nextMode: ShortcutsMode): Promise<void> => {
    mode = nextMode;
    items = mode === "mine" ? await store.list() : await options.loadTop();
    section.setAttribute(
      "aria-label",
      mode === "mine" ? "My shortcuts" : "Most visited sites",
    );
    draw();
  };

  const node = (
    <section class="yw-shortcuts" ref={(el) => (section = el)}>
      <ol class="yw-tiles" ref={(el) => (grid = el)} />
      <p class="yw-hint" hidden ref={(el) => (hint = el)} />
      <div
        class="yw-menu"
        role="menu"
        aria-label="Shortcut options"
        popover="auto"
        ref={(el) => {
          menu = el;
          el.addEventListener("keydown", onMenuKeydown);
          el.addEventListener("toggle", (event) => {
            if ((event as ToggleEvent).newState === "closed") {
              menuOwner?.setAttribute("aria-expanded", "false");
              menuOwner = undefined;
            }
          });
        }}
      />
      <dialog
        class="yw-dialog"
        aria-labelledby="yw-shortcut-title"
        ref={(el) => (dialog = el)}
      >
        <form
          method="dialog"
          novalidate
          onSubmit={(event) => {
            event.preventDefault();
            void saveDialog();
          }}
        >
          <h2
            id="yw-shortcut-title"
            class="yw-dialog-title"
            ref={(el) => (dialogTitle = el)}
          />
          <div class="yw-field">
            <label for="yw-shortcut-name">Name</label>
            <input
              id="yw-shortcut-name"
              class="yw-input"
              type="text"
              autocomplete="off"
              maxlength={MAX_TITLE_LENGTH}
              ref={(el) => (nameInput = el)}
            />
          </div>
          <div class="yw-field">
            <label for="yw-shortcut-url">Address</label>
            <input
              id="yw-shortcut-url"
              class="yw-input"
              type="text"
              inputmode="url"
              autocomplete="off"
              spellcheck="false"
              aria-describedby="yw-shortcut-error"
              required
              ref={(el) => (urlInput = el)}
              onInput={() => showError(undefined)}
            />
            <p
              id="yw-shortcut-error"
              class="yw-error"
              hidden
              ref={(el) => (errorText = el)}
            />
          </div>
          <div class="yw-dialog-actions">
            <button
              type="button"
              class="yw-button yw-button-danger"
              hidden
              ref={(el) => (removeButton = el)}
              onClick={() => {
                const target = editing;
                dialog.close();
                if (target) {
                  void remove(target);
                }
              }}
            >
              Remove
            </button>
            <span class="yw-spacer" />
            <button
              type="button"
              class="yw-button yw-button-text"
              onClick={() => dialog.close()}
            >
              Cancel
            </button>
            <button type="submit" class="yw-button yw-button-primary">
              Save
            </button>
          </div>
        </form>
      </dialog>
    </section>
  );

  return { node, refresh };
}
