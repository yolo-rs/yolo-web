// SPDX-License-Identifier: Apache-2.0
/** @jsx h */
/**
 * Resume browsing card (S04 card, flow F06): the pages opened in the last
 * 24 hours, one click away. It needs the optional `history` permission, which
 * is requested only from the button in this card, and says so before asking.
 * States: needs access, loading (skeleton rows), empty, filled.
 */
import {
  faviconUrl,
  hasHistoryAccess,
  loadRecentPages,
  requestHistoryAccess,
  type Visit,
} from "../browser-data.ts";
import { h } from "../../dom.ts";
import { Icon } from "./icons.tsx";

export interface ResumeCardOptions {
  readonly navigate: (url: string) => void;
  readonly hide: () => void;
  /** Called after access is granted, so suggestions can use page titles. */
  readonly onAccessChange: (granted: boolean) => void;
}

export interface ResumeCard {
  readonly node: HTMLElement;
  refresh(): Promise<void>;
}

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

export function timeAgo(then: number, now: number = Date.now()): string {
  const minutes = Math.round((then - now) / 60_000);
  if (Math.abs(minutes) < 1) {
    return relative.format(0, "minute");
  }
  if (Math.abs(minutes) < 60) {
    return relative.format(minutes, "minute");
  }
  return relative.format(Math.round(minutes / 60), "hour");
}

function host(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function ResumeCard(options: ResumeCardOptions): ResumeCard {
  let body!: HTMLElement;

  const skeleton = (): Node[] =>
    [0, 1, 2].map(() => <div class="yw-skeleton" aria-hidden="true" />);

  const needsAccess = (): Node => (
    <div>
      <p class="yw-card-body">
        See the pages you opened today and get back to them in one click. This
        needs permission to read your browsing history. The list is built in
        this browser and is never sent anywhere.
      </p>
      <div class="yw-dialog-actions">
        <button
          type="button"
          class="yw-button yw-button-primary"
          onClick={() => {
            void requestHistoryAccess().then((granted) => {
              options.onAccessChange(granted);
              void refresh();
            });
          }}
        >
          Allow access
        </button>
      </div>
    </div>
  );

  const list = (visits: readonly Visit[]): Node =>
    visits.length === 0 ? (
      <p class="yw-card-body">No pages opened in the last 24 hours.</p>
    ) : (
      <ul class="yw-visits">
        {visits.map((visit) => {
          const icon = faviconUrl(visit.url, 32);
          return (
            <li>
              <a
                class="yw-visit"
                href={visit.url}
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
                  options.navigate(visit.url);
                }}
              >
                {icon ? (
                  <img
                    src={icon}
                    alt=""
                    width={20}
                    height={20}
                    decoding="async"
                  />
                ) : (
                  <Icon name="page" />
                )}
                <span class="yw-visit-text">
                  <span class="yw-visit-title">{visit.title}</span>
                  <span class="yw-visit-meta">
                    {host(visit.url)} · {timeAgo(visit.lastVisit)}
                  </span>
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    );

  const refresh = async (): Promise<void> => {
    body.setAttribute("aria-busy", "true");
    body.replaceChildren(...skeleton());
    const granted = await hasHistoryAccess();
    body.replaceChildren(
      granted ? list(await loadRecentPages()) : needsAccess(),
    );
    body.removeAttribute("aria-busy");
  };

  const node = (
    <section class="yw-card" aria-labelledby="yw-resume-title">
      <div class="yw-card-header">
        <h2 id="yw-resume-title" class="yw-card-title">
          Opened today
        </h2>
        <button
          type="button"
          class="yw-icon-button"
          aria-label="Hide this card"
          onClick={options.hide}
        >
          <Icon name="close" />
        </button>
      </div>
      <div ref={(el) => (body = el)} />
    </section>
  );
  return { node: node as HTMLElement, refresh };
}
