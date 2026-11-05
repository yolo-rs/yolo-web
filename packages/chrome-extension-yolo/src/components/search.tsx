// SPDX-License-Identifier: Apache-2.0
/** @jsx h */
import { h } from "../dom.ts";
import { SEARCH_ACTION, SEARCH_PARAM } from "../navigation.ts";

/** Plain GET form: submitting navigates to `https://aphrody.com/search?q=`. */
export function SearchForm(): Node {
  return (
    <form class="yw-search" action={SEARCH_ACTION} method="get" role="search">
      <label class="yw-visually-hidden" for="yw-query">
        Search aphrody.com
      </label>
      <input
        id="yw-query"
        class="yw-search-input"
        type="search"
        name={SEARCH_PARAM}
        placeholder="Search aphrody.com"
        autocomplete="off"
        spellcheck="false"
        enterkeyhint="search"
        autofocus
      />
      <button class="yw-search-button" type="submit">
        Search
      </button>
    </form>
  );
}
