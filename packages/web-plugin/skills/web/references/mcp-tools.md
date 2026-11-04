# Unified Web MCP Server Tools Reference

The `web` MCP server exposes **53 tools** organized into 4 functional groups.

## 1. Browser Automation Tools (38 Tools — Obscura + Chromium V8)

- `browser_navigate`: Navigate to URL with adaptive network settling.
- `browser_snapshot`: DOM tree & accessibility snapshot generating stable interactive refs (`e1`, `e2`).
- `browser_click`: Click an element via ref or CSS selector.
- `browser_fill`: Clear and set input/textarea value.
- `browser_type`: Character-by-character keyboard input.
- `browser_press_key`: Send raw key event (Enter, Tab, Escape).
- `browser_select_option`: Select option element by value.
- `browser_evaluate`: Evaluate JavaScript in Chromium V8 isolate with timeout.
- `browser_wait_for_function`: Poll until JS predicate returns truthy.
- `browser_wait_for`: Wait for CSS selector or time delay.
- `browser_network_requests`: Inspect captured HTTP traffic and status codes.
- `browser_console_messages`: Read console log buffer.
- `browser_close`: Close active tab or browser session.
- `browser_markdown`: Extract reader-mode clean markdown.
- `browser_links`: Extract all page hyperlinks.
- `browser_interactive_elements`: List clickable elements with bounding boxes.
- `browser_back`: History back navigation.
- `browser_forward`: History forward navigation.
- `browser_reload`: Reload current page.
- `browser_get_cookies`: Retrieve session cookies.
- `browser_set_cookie`: Set cookie with attributes.
- `browser_clear_cookies`: Clear all session cookies.
- `browser_wait_for_text`: Wait for text occurrence in page.
- `browser_detect_forms`: Enumerate all forms and input fields.
- `browser_fill_form`: Multi-field form submission.
- `browser_scroll`: Viewport scrolling (top, bottom, delta).
- `browser_get_attribute`: Read DOM attribute.
- `browser_count`: Count selector occurrences.
- `browser_extract`: Extract structured data by JSON schema.
- `browser_tab_new`: Open new tab.
- `browser_tab_list`: List open tabs.
- `browser_tab_switch`: Switch active tab.
- `browser_tab_close`: Close tab by ID.
- `browser_search`: In-page text search with coordinate boxes.
- `browser_storage_state`: Export localStorage and sessionStorage.
- `browser_set_storage_state`: Import storage state.
- `browser_screenshot`: Viewport or element PNG capture.
- `browser_pdf`: Vector print PDF export.

## 2. Search Intelligence Tools (9 Tools — Brave Search & Shields)

- `brave_web_search`: Query Brave's independent Web index.
- `brave_llm_context`: Pre-extracted, token-budgeted web snippets for LLM grounding.
- `brave_image_search`: High-resolution web image discovery.
- `brave_video_search`: Web video search.
- `brave_news_search`: Global real-time news headlines.
- `brave_summarizer`: Brave AI synthesized summary and citations.
- `brave_shields_check`: Evaluate URL against adblock-rust network filters.
- `brave_answers`: Direct question-answering with citations.
- `brave_suggest`: Autocomplete suggestions.

## 3. Servo DOM & Layout Tools (3 Tools — Servo Stylo & XPath)

- `servo_css_specificity`: Compute exact Stylo specificity tuple `(a, b, c)` and 30-bit integer.
- `servo_xpath_to_css`: Translate XPath 1.0 queries into equivalent CSS3 selectors.
- `servo_parse_webvtt`: Parse WebVTT subtitle track cues and styling.

## 4. V8 & Chromium Engine Tools (3 Tools — Bun + V8 Bridge)

- `v8_runtime_info`: Inspect Host Bun (WebKit/JSC) vs Guest Browser (Chromium V8) runtime planes.
- `v8_evaluate_safe`: Validate and serialize script execution payloads for guest V8 isolate.
- `web_engine_status`: Report status across all monorepo pillars (Servo, Obscura, Brave, Bun, V8).
