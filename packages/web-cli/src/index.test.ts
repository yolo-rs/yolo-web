import { describe, expect, it } from "bun:test";
import { createWebCli } from "./index.js";

describe("@yolo-web/web-cli - Unified 'web' Command", () => {
  it("constructs unified CLI with all subcommands", () => {
    const cli = createWebCli();
    expect(cli.name()).toBe("web");
    const cmdNames = cli.commands.map((c) => c.name());
    expect(cmdNames).toContain("fetch");
    expect(cmdNames).toContain("search");
    expect(cmdNames).toContain("context");
    expect(cmdNames).toContain("shields");
    expect(cmdNames).toContain("servo");
    expect(cmdNames).toContain("mcp");
    expect(cmdNames).toContain("serve");
    expect(cmdNames).toContain("info");
    expect(cmdNames).toContain("mirror");
  });

  it("handles servo selector specificity subcommand", async () => {
    const cli = createWebCli();
    cli.exitOverride();

    let output = "";
    const origLog = console.log;
    console.log = (msg: string) => {
      output += msg;
    };

    try {
      await cli.parseAsync(["node", "web", "servo", "#id .class tag"]);
      expect(output).toContain("servo-stylo");
      const parsed = JSON.parse(output);
      expect(parsed.specificity.id).toBe(1);
      expect(parsed.specificity.class).toBe(1);
      expect(parsed.specificity.element).toBe(1);
    } finally {
      console.log = origLog;
    }
  });

  it("handles shields check subcommand", async () => {
    const cli = createWebCli();
    cli.exitOverride();

    let output = "";
    const origLog = console.log;
    console.log = (msg: string) => {
      output += msg;
    };

    try {
      await cli.parseAsync([
        "node",
        "web",
        "shields",
        "https://ad.doubleclick.net/ad.js?utm_source=test",
      ]);
      expect(output).toContain("blocked");
      const parsed = JSON.parse(output);
      expect(parsed.blocked).toBe(true);
      expect(parsed.cleanUrl).toBe("https://ad.doubleclick.net/ad.js");
      expect(parsed.strippedParams).toContain("utm_source");
    } finally {
      console.log = origLog;
    }
  });

  it("handles info subcommand returning full engine pillar summary", async () => {
    const cli = createWebCli();
    cli.exitOverride();

    let output = "";
    const origLog = console.log;
    console.log = (msg: string) => {
      output += msg;
    };

    try {
      await cli.parseAsync(["node", "web", "info", "--json"]);
      const parsed = JSON.parse(output);
      expect(parsed.name).toBe("web");
      expect(parsed.monorepoPillars.servo).toContain("31 crates");
      expect(parsed.monorepoPillars.obscura).toContain("10 crates");
      expect(parsed.monorepoPillars.brave).toContain("5 crates");
      expect(parsed.hostRuntimePlane.runtime).toBe("bun");
    } finally {
      console.log = origLog;
    }
  });

  it("handles vault sync-profile and index-ecosystem subcommands", async () => {
    const cli = createWebCli();
    cli.exitOverride();

    let output = "";
    const origLog = console.log;
    console.log = (msg: string) => {
      output += msg;
    };

    try {
      await cli.parseAsync(["node", "web", "vault", "sync-profile"]);
      const syncParsed = JSON.parse(output);
      expect(syncParsed.sourceGoogleAccount).toBe("yohanpierre15@gmail.com");
      expect(syncParsed.targetYoloProfile).toBe("aphrody-yolo");

      output = "";
      await cli.parseAsync(["node", "web", "index-ecosystem"]);
      const indexParsed = JSON.parse(output);
      expect(indexParsed.indexedDomainRecords).toBeGreaterThanOrEqual(5);
      expect(indexParsed.registries).toEqual([
        "github",
        "npm",
        "crates.io",
        "pypi",
        "go",
      ]);
    } finally {
      console.log = origLog;
    }
  });

  it("handles mirror commands subcommand for https://bun.com/", async () => {
    const cli = createWebCli();
    cli.exitOverride();

    let output = "";
    const origLog = console.log;
    console.log = (msg: string) => {
      output += msg;
    };

    try {
      await cli.parseAsync(["node", "web", "mirror", "commands"]);
      const parsed = JSON.parse(output);
      expect(parsed.curl).toContain("https://bun.com/");
      expect(parsed.wget2).toContain("https://bun.com/");
    } finally {
      console.log = origLog;
    }
  });
});
