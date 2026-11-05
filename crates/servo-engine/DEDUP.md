# servo-engine deduplication

`crates/servo-engine` is an excluded (not built) Servo snapshot. Ten of its
`components/*` crates duplicated workspace crates and were removed (65 files,
about 363 KiB). The workspace crates are canonical.

| Removed (was under `crates/servo-engine/components/`) | Canonical replacement |
| --- | --- |
| `allocator` | `crates/servo-allocator` |
| `deny_public_fields` | `crates/servo-deny-public-fields` |
| `dom_struct` | `crates/servo-dom-struct` |
| `hyper_serde` | `crates/servo-hyper-serde` |
| `svg` | `crates/servo-svg` |
| `servo_tracing` | `crates/servo-tracing` |
| `timers` | `crates/servo-timers` |
| `url` | `crates/servo-url` |
| `webvtt` | `crates/servo-webvtt` |
| `xpath` | `crates/servo-xpath` |

Comparison before removal:

- Byte-identical: allocator, deny_public_fields, dom_struct, hyper_serde, svg, servo_tracing.
- Differing only by cargo fmt: timers and most webvtt/xpath files.
- Real differences, all in the workspace copies (kept): `servo-url` Cargo.toml
  enables the `url` feature of malloc_size_of, `rc` of serde and `servo` of
  servo_arc; `servo-url` (`lib.rs`, `origin.rs`) and `servo-webvtt`
  (`cue/text.rs`) replace let-chains with nested `if let`; `servo-xpath`
  `ast.rs` adds an `ignore_malloc_size_of` attribute on `Name(QualName)`.

The rest of `components/` (no workspace duplicate) is untouched. Within the
snapshot, `components/servo/Cargo.toml` already depends on these crates through
`workspace = true` (for example `servo-url`), which resolves to the workspace
crates above.

Provenance: the snapshot arrived in the initial import commit `74f5b8a4`
(2026-11-04) from `servo/servo`; no upstream commit hash is recorded anywhere
in the folder or repository. Recover the exact pin from the upstream tree
if needed before re-syncing.
