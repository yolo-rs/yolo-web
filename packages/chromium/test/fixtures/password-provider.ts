import type { ChromiumPasswordProvider } from "../../src/passwords.ts";

export function createTestPasswordProvider(
  csv: string,
  assertProtectedPath: () => void = () => {},
): ChromiumPasswordProvider {
  const lines = csv.trim().split(/\r?\n/);
  const records = Math.max(0, lines.length - 1);
  return {
    audit() {
      assertProtectedPath();
      return { records, supportedWebOrigins: records, credentialsWithPassword: records, unsupportedRecords: 0 };
    },
    async withCredential(selector, consumer) {
      assertProtectedPath();
      const row = lines.slice(1).map(line => line.split(","));
      const match = row.find(([, url, username]) =>
        url &&
        new URL(url).origin === new URL(selector.url).origin &&
        (selector.username === undefined || username === selector.username),
      );
      if (!match) throw new Error("No matching test credential");
      const [name, url, username, password] = match;
      if (!name || !url || !username || !password) throw new Error("Invalid test credential");
      await consumer({ name, url, username, password });
    },
  };
}
