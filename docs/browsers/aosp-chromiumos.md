# AOSP + ChromiumOS build prerequisites (Linux `vps`)

Both are **Linux-only** and cannot build on the Windows workstation; they are routed
to the `vps`. All work is confined to `~/src/yolo-work/browsers-prereq/`. The existing
`~/src/yolo-work/vps-android` (and its `docs/receipts/`) was **not** modified.

Checker (read-only, nothing installed): `scripts/browsers/vps-aosp-cros-prereq.sh`
Receipt: `docs/browsers/receipts/vps-aosp-cros-prereq.txt`

Sources:
- AOSP requirements: https://source.android.com/docs/setup/start/requirements
- AOSP env init: https://source.android.com/docs/setup/start/initializing
- ChromiumOS guide: https://www.chromium.org/chromium-os/developer-library/guides/development/developer-guide/

## vps snapshot (detected 2026-11-04)

| | |
|---|---|
| OS | Ubuntu 26.10 (VERSION_ID 26.10), kernel 7.3.0-9-generic, glibc 2.44 |
| arch | x86_64 |
| CPU / RAM | 12 cores / 45 GiB (37 GiB avail) |
| `~` free | 333 GB (/home, 805 GB volume) |
| toolchain | git 2.55.0, python3 3.12.15, openjdk 25, depot_tools at `~/depot_tools` |
| depot_tools bins | repo, gn, cros_sdk, gclient, fetch present (not on PATH); ninja+ccache system |

## AOSP

Official requirements: 64-bit Linux (glibc >=2.17; Ubuntu 18.04+), **>=64 GB RAM**,
**>=400 GB disk** (250 checkout + 150 build), `repo` launcher **>=2.4**. OpenJDK, Make
and Python 3 ship prebuilt in the release branch.

Apt packages (verbatim from the official init page):
```
sudo apt-get install git-core gnupg flex bison build-essential zip curl zlib1g-dev \
  libc6-dev-i386 x11proto-core-dev libx11-dev lib32z1-dev libgl1-mesa-dev \
  libxml2-utils xsltproc unzip fontconfig
```
On this vps, present except **missing**: `git-core` (git 2.55 is installed),
`libc6-dev-i386`, `x11proto-core-dev`, `lib32z1-dev`, `libgl1-mesa-dev`. **Not
installed by this task** (no apt-get run); the command above adds them when ready.

`repo` (not on PATH; `~/depot_tools/repo` exists). Official install (not run):
```
sudo apt-get install repo        # or the manual launcher:
export REPO=$(mktemp /tmp/repo.XXXXXXXXX)
curl -o ${REPO} https://storage.googleapis.com/git-repo-downloads/repo
gpg --recv-keys 8BB9AD793E8E6153AF0F9A4416530D5E920F5C65
curl -s https://storage.googleapis.com/git-repo-downloads/repo.asc | gpg --verify - ${REPO} && install -m 755 ${REPO} ~/bin/repo
repo version                     # must report >= 2.4
```

Checkout/build (NOT run — would pull 250+ GB):
```
mkdir -p ~/src/yolo-work/aosp && cd ~/src/yolo-work/aosp
repo init -u https://android.googlesource.com/platform/manifest -b <branch>
repo sync -c -j8          # ~250 GB, hours
source build/envsetup.sh && lunch <target> && m            # ~150 GB more
```

**Verdict: BLOCKED (under-spec).** RAM 45 GB < 64 GB required; `~` free 333 GB < 400 GB
required (250 GB checkout would fit, but +150 GB build would not). Needs more RAM and a
>=400 GB target before an AOSP build is attempted.

## ChromiumOS

Official: Linux-only, **Ubuntu 22.04 (Jammy)** officially supported (Debian trixie
common). RAM "many GB" (Chrome link 8-28 GB) — 45 GB is ample. Disk: initial download
~2 GB, first `cros build-packages` ~3 GB, each `cros build-image` up to 8 GB; a full
checkout + SDK chroot + build is practically **~90-120 GB**. `depot_tools` provides
`repo` and `cros_sdk`. `umask` last digit <= 2.

Host tools (not run): `sudo apt-get install git gitk git-gui curl util-linux util-linux-extra`
(this vps has git/curl/util-linux; missing optional `gitk`, `git-gui`).

Checkout/build (NOT run):
```
umask 022
mkdir -p ~/chromiumos && cd ~/chromiumos         # or under ~/src/yolo-work
PATH="$HOME/depot_tools:$PATH"
repo init -u https://chromium.googlesource.com/chromiumos/manifest -b stable
repo sync -j4                 # no more than 8 concurrent jobs
cros_sdk                      # creates/enters the SDK chroot on first run
BOARD=amd64-generic
cros build-packages --board=${BOARD} --autosetgov --autosetgov-sticky
cros build-image --board=${BOARD} --no-enable-rootfs-verification test
```

**Verdict: FEASIBLE on disk/RAM.** `~` free 333 GB >> ~120 GB practical; RAM 45 GB ample;
`depot_tools` already supplies `repo` + `cros_sdk`. **Caveat:** OS is Ubuntu 26.10, not
the officially supported 22.04 — verify SDK/chroot compatibility before a real build.
Nothing was synced or built.

## Budget summary

| Target | Disk | RAM | vps status |
|---|---|---|---|
| AOSP | >=400 GB (250+150) | >=64 GB | BLOCKED: RAM 45<64, disk 333<400 |
| ChromiumOS | ~90-120 GB practical | 8-28 GB | FEASIBLE (OS 26.10 vs 22.04 caveat) |
