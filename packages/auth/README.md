# @yolo-web/auth

Bun-native session, passkey, owner-identity, and multi-account APIs used by the Google integration.
The API is carried forward with its existing cookie and identity protocol for compatibility; it is
not a new authentication authority or a replacement for deployment-owned credentials.

Source and Apache-2.0 notices are preserved from the BunOS archive. No user or session is seeded by
default. Consumers must create accounts and sessions through their own identity flow.

Production deployments must set `YOLO_WEB_SESSION_KEY` to at least 32 characters. The explicit
legacy `APHRODY_WEBOS_SESSION_KEY` alias remains supported. Local development without a configured
key gets a random process-local secret, so sessions expire when the process restarts. Configure
allowed browser origins with `YOLO_WEB_AUTH_ORIGINS`; production passkey deployments must set
`YOLO_WEB_AUTH_RP_ID`.

Source origin: archived BunOS `packages/auth`, Apache-2.0.
