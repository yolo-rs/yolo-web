# Large identical files inside yolo-web

Method: `git ls-files -s` blob hashes grouped by hash, files over 20 KB,
excluding LICENSE/COPYING and lockfiles (9,169 tracked files scanned,
after the servo-engine dedup, see `crates/servo-engine/DEDUP.md`).

| Size | Paths | Decision |
| --- | --- | --- |
| 2.7 MB | `crates/brave-adblock/data/test/sitelist.txt`, `.../top500-sitelist.txt` | Removed `sitelist.txt` (no reference in code, tests or benches); `top500-sitelist.txt` kept. |
| 714 KB | `crates/servo-webrender/wrench/reftests/{compositor-surface,text}/FreeSans.ttf` | Kept: reftest YAML files reference the font by relative path. |
| 45 KB | `crates/servo-webrender/wrench/reftests/{filters,transforms}/firefox.png` | Kept: same reason. |

No vendor/ vs crates/ or third_party/ vs crates/ identical pairs were found.
