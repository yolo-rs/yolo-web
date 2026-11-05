// SPDX-License-Identifier: Apache-2.0
// Minimal ambient declaration: the extension uses a small, documented subset of the chrome.* API
// (debugger, tabs, storage, runtime, offscreen, sidePanel, action). @types/chrome is not vendored.
// biome-ignore lint/suspicious/noExplicitAny: loosely typed platform namespace
declare const chrome: any;
