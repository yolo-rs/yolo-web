# @yolo-web/posix-bun

POSIX.1-2024 and GNU compatibility helpers for Bun applications. This package
provides typed errno and signal catalogs, VFS and termios constants, and GNU
style option parsing. It contains no native addon and runs on the Bun platforms
supported by the host runtime.

```ts
import { getoptLong, HasArg } from "@yolo-web/posix-bun";

const parsed = getoptLong(["--output", "result.bin"], "", [
  { name: "output", hasArg: HasArg.RequiredArgument, val: "output" },
]);
```

The `parseGnuOptions` API accepts a command-specific option schema; see
`src/gnu.ts` for the types and behavior. The package does not invoke shell
commands or modify host services.

Source: [yolo-zig](https://github.com/yolo-rs/yolo-zig/tree/main/packages/yolo-posix-bun).
This source is integrated into the yolo-web workspace so its package and release
can evolve alongside the Bun browser CLI. License: Apache-2.0. See `NOTICE.md`
for source attribution.
