# @yolo-web/google

Bun-native Google Cloud and Gemini clients, Drive and Docs synchronization, public search,
font/edge proxies, and `bun:google` integration for YOLO-Web.

The package consumes the workspace Chromium wrapper through `@yolo-web/chromium` and reuses the
explicit session identity API from `@yolo-web/auth`. It does not include Google service credentials.
Credential providers must be supplied by the caller or use the read-only platform integration.
The Google Cloud project must be explicitly set with `YOLO_WEB_GOOGLE_PROJECT` or
`GOOGLE_CLOUD_PROJECT`; no project, user, or account identity is assumed. Drive sync paths default
to the current user's `.yolo-web` directory and folder IDs must be explicitly configured.

The source and Apache-2.0 notices are preserved from the BunOS archive. Application integrations
and secrets remain owned by their consuming deployment.

The `bun:google` compatibility facade originates in `aphrody-labs/bun` at fork commit
`7c57ac563e12c35be817697c4b5488b0fd64cc09`; the Google Workspace package source is retained from
the archived BunOS `packages/google` tree.
