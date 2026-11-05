# yolo-zig: replace packages/yolo-posix-bun by yolo-web packages/posix-bun

Status: change NOT applied (yolo-zig has uncommitted work from other sessions).
Apply it in `C:\src\yolo-zig` once its tree is clean.

Measured: `packages/yolo-posix-bun/src/{errno,index}.ts` are byte-identical to
`yolo-web/packages/posix-bun/src/`; `gnu.ts`, `signal.ts`, `termios.ts`, `vfs.ts`
differ only by formatting (alignment padding, trailing comma). yolo-web is
canonical (formatted by `bun fmt`).

## Changes in yolo-zig

1. Remove the package: `git rm -r packages/yolo-posix-bun`
   (LICENSE, NOTICE.md, README.md, package.json, src/*.ts). Keep the Apache-2.0
   attribution by moving the NOTICE text to the yolo-web package if not present.
2. Add the dependency. The workspace glob `packages/*` in `package.json` stays;
   consume the yolo-web package as a git/path dependency in the root
   `package.json`:
   `"dependencies": { "@yolo-web/posix-bun": "github:yolo-rs/yolo-web#main" }`
   (a path dependency `file:../yolo-web/packages/posix-bun` works for sibling
   checkouts), then run `bun install`. Do not use npm/yarn.
3. `tools/yolo-zig.ts` line 3:
   - from: `import { getoptLong, HasArg } from "../packages/yolo-posix-bun/src/index.ts";`
   - to:   `import { getoptLong, HasArg } from "@yolo-web/posix-bun";`
4. `README.mdx` line 11: replace
   "integrates `yolo-posix-bun` source from `yolo-standards` as `packages/yolo-posix-bun` (Apache-2.0)"
   by
   "depends on `@yolo-web/posix-bun` (`yolo-web/packages/posix-bun`, Apache-2.0)".
5. `docs/ARCHITECTURE.mdx` line 57: replace
   "The relevant source from `yolo-standards` is integrated into [`packages/yolo-posix-bun`](../packages/yolo-posix-bun/NOTICE.md)"
   by
   "The relevant source is consumed from [`yolo-web/packages/posix-bun`](https://github.com/yolo-rs/yolo-web/tree/main/packages/posix-bun) as `@yolo-web/posix-bun`".
6. Verify: `bun install`, `bun check`, `bun tools/yolo-zig.ts doctor`,
   then `git grep -n yolo-posix-bun` must return nothing.
