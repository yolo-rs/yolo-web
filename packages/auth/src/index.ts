// SPDX-License-Identifier: Apache-2.0
/**
 * @yolo-web/auth — Bun-native session and owner-identity APIs.
 * Passkeys (WebAuthn), Session Cookies, Owner Identity Verification, Multi-Account Presence,
 * Google Authenticator TOTP (RFC 6238 / QR / otpauth://), Encrypted Multi-DB Vault (SQLite WAL + Postgres + Redis),
 * and Bilingual (en/fr) Localization.
 */

export * from "./types.ts";
export * from "./i18n.ts";
export * from "./passkey.ts";
export * from "./session.ts";
export * from "./database.ts";
export * from "./multi-account.ts";
export * from "./tanstack.ts";
export * from "./server.ts";
export * from "./totp-authenticator.ts";
export * from "./secure-vault.ts";
