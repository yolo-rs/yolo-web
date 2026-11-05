/**
 * Credential provider over Application Default Credentials (google-auth-library), for
 * `createClient({ credentialProvider })`. Tokens stay in the auth library's cache.
 */
export function adcCredentialProvider(
  scopes: string | string[] = "https://www.googleapis.com/auth/cloud-platform",
): (signal?: AbortSignal) => Promise<string> {
  let client:
    | Promise<{ getAccessToken(): Promise<{ token?: string | null }> }>
    | undefined;
  return async (signal) => {
    signal?.throwIfAborted();
    client ??= import("google-auth-library").then(({ GoogleAuth }) =>
      new GoogleAuth({ scopes }).getClient(),
    );
    const { token } = await (await client).getAccessToken();
    if (!token)
      throw new Error(
        "Application Default Credentials returned no access token",
      );
    return token;
  };
}
