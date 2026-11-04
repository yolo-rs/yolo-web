// SPDX-License-Identifier: Apache-2.0
import { describe, expect, test } from "bun:test";
import {
  AuthDatabase,
  MultiAccountManager,
  SovereignQueryClient,
  authQueryKeys,
  createBetterAuthServer,
  createPasskeyAuthOptions,
  createPasskeyRegistrationOptions,
  createSessionCookie,
  getTranslation,
  signSessionToken,
  t,
  verifyOwnerIdentity,
  verifyPasskeyAuthResponse,
  verifyPasskeyRegistrationResponse,
  verifySessionToken,
  resolveSessionSecret,
} from "../src/index.ts";

describe("@yolo-web/auth - session and identity API", () => {
  const secret = "test-secret-key-that-is-at-least-32-chars-long!";
  const now = Date.now();

  function addUser(db: AuthDatabase, id: string, email: string, role: "owner" | "developer" | "guest") {
    const user = {
      id,
      email,
      name: role === "owner" ? "Test Owner" : `Test ${role}`,
      role,
      isOwner: role === "owner",
      createdAt: now,
      updatedAt: now,
    } as const;
    db.createUser(user);
    return user;
  }

  function addSession(db: AuthDatabase, userId: string, token: string) {
    const session = {
      id: `session-${token}`,
      userId,
      token,
      expiresAt: Date.now() + 3600_000,
      activeAccountId: userId,
      isOwnerVerified: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    db.createSession(session);
    return session;
  }

  test("database starts without an implicit account, passkey, or owner identity", () => {
    const db = new AuthDatabase(":memory:");
    expect(db.listUsers()).toEqual([]);
    expect(db.getPasskeyByCredentialId("legacy-owner-key")).toBeNull();
  });

  test("multi-account manager handles active account presence and switching", () => {
    const db = new AuthDatabase(":memory:");
    const manager = new MultiAccountManager(db);
    const owner = addUser(db, "test-owner", "owner@yolo-web.test", "owner");
    const dev = addUser(db, "test-dev", "dev@yolo-web.test", "developer");
    addUser(db, "test-guest", "guest@yolo-web.test", "guest");

    const session = {
      id: "sess_1",
      userId: owner.id,
      token: "tok_123",
      expiresAt: Date.now() + 3600_000,
      activeAccountId: owner.id,
      isOwnerVerified: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    db.createSession(session);

    // Initial presence
    const presence1 = manager.getPresence(session);
    expect(presence1.activeAccount.id).toBe(owner.id);
    expect(presence1.isOwner).toBe(true);
    expect(presence1.accounts.length).toBe(3);

    // Switch to developer account
    const presence2 = manager.switchActiveAccount("tok_123", dev.id);
    expect(presence2.activeAccount.id).toBe(dev.id);
    expect(presence2.isOwner).toBe(false);
  });

  test("session token signing and owner identity verification", async () => {
    const claims = {
      sub: "owner@yolo-web.test",
      iss: "yolo-web" as const,
      aud: "yolo-web" as const,
      role: "owner" as const,
      is_owner: true,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    };

    const token = await signSessionToken(claims, secret);
    expect(token.split(".").length).toBe(3);

    const verified = await verifySessionToken(token, secret);
    expect(verified).not.toBeNull();
    expect(verified?.sub).toBe("owner@yolo-web.test");
    expect(verified?.is_owner).toBe(true);

    // Test owner verification over HTTP headers
    const headers = new Headers();
    headers.set("cookie", `yolo_web_session=${encodeURIComponent(token)}`);
    headers.set("origin", "https://app.yolo-web.test");

    const ownerCheck = await verifyOwnerIdentity(headers, secret, { allowedOrigins: ["https://app.yolo-web.test"] });
    expect(ownerCheck.isOwner).toBe(true);
    expect(ownerCheck.claims?.role).toBe("owner");
  });

  test("requires an explicit production session key and uses an ephemeral development key", () => {
    expect(() => resolveSessionSecret(undefined, { NODE_ENV: "production" })).toThrow("must be configured");
    expect(resolveSessionSecret(secret, { NODE_ENV: "production" })).toBe(secret);
    const ephemeral = resolveSessionSecret(undefined, { NODE_ENV: "development" });
    expect(ephemeral).toHaveLength(64);
    expect(resolveSessionSecret(undefined, { NODE_ENV: "development" })).toBe(ephemeral);
  });

  test("passkey registration and authentication options generation", () => {
    const owner = {
      id: "test-owner",
      email: "owner@yolo-web.test",
      name: "Test Owner",
      role: "owner" as const,
      isOwner: true,
      createdAt: now,
      updatedAt: now,
    };

    const regOpts = createPasskeyRegistrationOptions(owner, "app.yolo-web.test", "YOLO-Web");
    expect(regOpts.challenge.length).toBeGreaterThan(20);
    expect(regOpts.rp.name).toBe("YOLO-Web");
    expect(regOpts.rp.id).toBe("app.yolo-web.test");
    expect(regOpts.user.name).toBe("owner@yolo-web.test");

    const authOpts = createPasskeyAuthOptions("app.yolo-web.test", [{ id: "cred_123" }]);
    expect(authOpts.challenge.length).toBeGreaterThan(20);
    expect(authOpts.allowCredentials?.[0]?.id).toBe("cred_123");
  });

  test("bilingual internationalization (en/fr) provides correct labels", () => {
    expect(t("roleOwner", "en")).toBe("Sovereign Owner");
    expect(t("roleOwner", "fr")).toBe("Propriétaire Souverain");

    expect(t("passkey", "en")).toBe("Passkey");
    expect(t("passkey", "fr")).toBe("Clé d'accès (Passkey)");

    expect(t("filterAll", "en")).toBe("All");
    expect(t("filterAll", "fr")).toBe("Tous");

    expect(t("searchPlaceholder", "fr")).toContain("Rechercher fichiers locaux");
  });

  test("TanStack query client provides caching, subscriptions, and stale-while-revalidate", async () => {
    const queryClient = new SovereignQueryClient({ defaultStaleTime: 1000 });
    let notifications = 0;

    const unsubscribe = queryClient.subscribe(authQueryKeys.session(), data => {
      notifications++;
    });

    queryClient.setQueryData(authQueryKeys.session(), { user: "owner" });
    expect(queryClient.getQueryData(authQueryKeys.session())).toEqual({ user: "owner" });
    expect(notifications).toBe(1);

    // Fetch with cache
    let fetchCount = 0;
    const fetcher = async () => {
      fetchCount++;
      return { user: "fresh_user" };
    };

    const res1 = await queryClient.fetchQuery(authQueryKeys.session(), fetcher);
    // Should return cached since staleTime has not elapsed
    expect(res1).toEqual({ user: "owner" });
    expect(fetchCount).toBe(0);

    unsubscribe();
  });

  test("better auth HTTP server handles endpoints", async () => {
    const db = new AuthDatabase(":memory:");
    const owner = addUser(db, "test-owner", "owner@yolo-web.test", "owner");
    const dev = addUser(db, "test-dev", "dev@yolo-web.test", "developer");
    addUser(db, "test-guest", "guest@yolo-web.test", "guest");
    addSession(db, owner.id, "test-session-token");
    const authServer = createBetterAuthServer({ db, secret, rpId: "app.yolo-web.test" });
    const cookie = createSessionCookie("test-session-token", 3600, false);

    const anonymous = await authServer.routes["/api/auth/session"](new Request("http://localhost/api/auth/session"));
    expect(anonymous.status).toBe(401);

    // Authenticated session endpoint.
    const sessionReq = new Request("http://localhost/api/auth/session", { headers: { cookie } });
    const sessionRes = await authServer.routes["/api/auth/session"](sessionReq);
    expect(sessionRes.status).toBe(200);
    const sessionData = await sessionRes.json();
    expect(sessionData.activeAccount.email).toBe("owner@yolo-web.test");
    expect(sessionRes.headers.get("Set-Cookie")).toContain("yolo_web_session=");

    // 2. Accounts endpoint
    const accountsReq = new Request("http://localhost/api/auth/accounts", { headers: { cookie } });
    const accountsRes = await authServer.routes["/api/auth/accounts"](accountsReq);
    expect(accountsRes.status).toBe(200);
    const accountsData = await accountsRes.json();
    expect(accountsData.accounts.length).toBe(3);

    // 3. Switch account endpoint
    const switchReq = new Request("http://localhost/api/auth/accounts/switch", {
      method: "POST",
      body: JSON.stringify({ accountId: dev.id }),
      headers: { cookie },
    });
    const switchRes = await authServer.routes["/api/auth/accounts/switch"](switchReq);
    expect(switchRes.status).toBe(200);
    const switchData = await switchRes.json();
    expect(switchData.activeAccount.id).toBe(dev.id);
  });
});
