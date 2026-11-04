import { describe, expect, it } from 'bun:test';
import { isLoopbackHostname, parsePort, readBraveApiKeyFromFile } from './utils.js';

const assert = {
  equal(actual: unknown, expected: unknown): void {
    expect(actual).toEqual(expected);
  },
  match(actual: string, pattern: RegExp): void {
    expect(actual).toMatch(pattern);
  },
};

const tempRoot = Bun.env.TMPDIR ?? Bun.env.TEMP ?? Bun.env.TMP ?? process.cwd();
const tempFile = (name: string): string =>
  `${tempRoot.replace(/[\\/]$/, '')}/brave-api-key-${crypto.randomUUID()}-${name}`;

describe('parsePort', () => {
  it('accepts valid integer ports', () => {
    assert.equal(parsePort(8080), 8080);
    assert.equal(parsePort('8080'), 8080);
    assert.equal(parsePort(1), 1);
    assert.equal(parsePort(65535), 65535);
  });

  it('rejects non-numeric and out-of-range values', () => {
    assert.equal(parsePort('abc'), null);
    assert.equal(parsePort('8080abc'), null);
    assert.equal(parsePort('8080.5'), null);
    assert.equal(parsePort(0), null);
    assert.equal(parsePort(65536), null);
    assert.equal(parsePort(-1), null);
    assert.equal(parsePort(''), null);
    assert.equal(parsePort(null), null);
    assert.equal(parsePort(undefined), null);
  });
});

describe('isLoopbackHostname', () => {
  it('accepts localhost and the IPv6 loopback', () => {
    assert.equal(isLoopbackHostname('localhost'), true);
    assert.equal(isLoopbackHostname('::1'), true);
  });

  it('accepts addresses across the whole IPv4 127.0.0.0/8 range', () => {
    assert.equal(isLoopbackHostname('127.0.0.1'), true);
    assert.equal(isLoopbackHostname('127.0.0.0'), true);
    assert.equal(isLoopbackHostname('127.1.2.3'), true);
    assert.equal(isLoopbackHostname('127.255.255.255'), true);
    assert.equal(isLoopbackHostname('127.0.0.255'), true);
  });

  it('rejects non-loopback IPv4 addresses', () => {
    assert.equal(isLoopbackHostname('128.0.0.1'), false);
    assert.equal(isLoopbackHostname('126.255.255.255'), false);
    assert.equal(isLoopbackHostname('0.0.0.0'), false);
    assert.equal(isLoopbackHostname('192.168.0.1'), false);
    assert.equal(isLoopbackHostname('10.0.0.1'), false);
  });

  it('rejects IPv4 octets outside 0-255', () => {
    assert.equal(isLoopbackHostname('127.0.0.256'), false);
    assert.equal(isLoopbackHostname('127.0.0.999'), false);
  });

  it('rejects addresses without exactly four octets', () => {
    assert.equal(isLoopbackHostname('127'), false);
    assert.equal(isLoopbackHostname('127.0.0'), false);
    assert.equal(isLoopbackHostname('127.0.0.1.2'), false);
    assert.equal(isLoopbackHostname(''), false);
  });

  it('rejects non-numeric or malformed IPv4 octets', () => {
    assert.equal(isLoopbackHostname('127.0.0.x'), false);
    assert.equal(isLoopbackHostname('127.0.0.-1'), false);
    assert.equal(isLoopbackHostname('127.0.0.1abc'), false);
    assert.equal(isLoopbackHostname('127.0.0. 1'), false);
    assert.equal(isLoopbackHostname('0127.0.0.1'), false);
  });

  it('rejects non-loopback hostnames and non-normalized input', () => {
    assert.equal(isLoopbackHostname('example.com'), false);
    // Callers normalize (lowercase) before calling, so uppercase is not matched.
    assert.equal(isLoopbackHostname('LOCALHOST'), false);
  });
});

describe('readBraveApiKeyFromFile', () => {
  it('reads and trims API keys from a file', async () => {
    const filePath = tempFile('key.txt');
    await Bun.write(filePath, 'test-api-key\n');

    try {
      const result = await readBraveApiKeyFromFile(filePath);
      assert.equal(result.ok, true);
      if (result.ok) assert.equal(result.key, 'test-api-key');
    } finally {
      await Bun.file(filePath).delete();
    }
  });

  it('rejects empty files', async () => {
    const filePath = tempFile('empty.txt');
    await Bun.write(filePath, '\n');

    try {
      const result = await readBraveApiKeyFromFile(filePath);
      assert.equal(result.ok, false);
      if (!result.ok) assert.match(result.error, /empty/i);
    } finally {
      await Bun.file(filePath).delete();
    }
  });

  it('reports missing files with the path and reason', async () => {
    const filePath = tempFile('missing.txt');
    const result = await readBraveApiKeyFromFile(filePath);
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error, /brave-api-key/);
  });
});
