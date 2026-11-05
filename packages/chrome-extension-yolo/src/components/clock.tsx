// SPDX-License-Identifier: Apache-2.0
/** @jsx h */
import { h } from "../dom.ts";

const timeFormat = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
});

const dateFormat = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  day: "numeric",
  month: "long",
});

/** Local time and date, refreshed on the second. */
export function Clock(): Node {
  let timeElement!: HTMLTimeElement;
  let dateElement!: HTMLElement;

  const tick = (): void => {
    const now = new Date();
    timeElement.textContent = timeFormat.format(now);
    timeElement.dateTime = now.toISOString();
    dateElement.textContent = dateFormat.format(now);
  };

  const node = (
    <section class="yw-clock" aria-label="Clock">
      <time class="yw-time" ref={(element) => (timeElement = element)} />
      <div class="yw-date" ref={(element) => (dateElement = element)} />
    </section>
  );

  tick();
  window.setTimeout(
    () => {
      tick();
      window.setInterval(tick, 1000);
    },
    1000 - (Date.now() % 1000),
  );
  return node;
}
