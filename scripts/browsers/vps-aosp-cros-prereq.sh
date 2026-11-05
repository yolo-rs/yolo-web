#!/usr/bin/env bash
# Read-only AOSP + ChromiumOS build-prereq checker for the Linux vps.
# CHANGES NOTHING: no apt-get, no repo init/sync, no fetch, no cros_sdk.
# Detection + budgets only. Sources:
#   AOSP: https://source.android.com/docs/setup/start/requirements
#         https://source.android.com/docs/setup/start/initializing
#   CrOS: https://www.chromium.org/chromium-os/developer-library/guides/development/developer-guide/
set -u
row(){ printf '%-28s %s\n' "$1" "$2"; }
loc(){ command -v "$1" 2>/dev/null || { [ -x "$HOME/depot_tools/$1" ] && echo "$HOME/depot_tools/$1 (depot_tools, not on PATH)"; } || echo MISSING; }

echo "=== vps AOSP + ChromiumOS prereq check (read-only) ==="
row date "$(date '+%F %T %z')"
row host "$(hostname)"
row arch "$(uname -m)"
row kernel "$(uname -r)"
row os "$(. /etc/os-release 2>/dev/null; echo "${PRETTY_NAME:-?} (VERSION_ID=${VERSION_ID:-?})")"
row glibc "$(ldd --version 2>/dev/null | head -1 | awk '{print $NF}')"
row cpus "$(nproc)"
row ram "$(free -g | awk '/^Mem:/{print $2" GiB total, "$7" GiB avail"}')"
row home_free "$(df -BG --output=avail "$HOME" 2>/dev/null | tail -1 | tr -d ' ')"

echo; echo "--- toolchain ---"
row git "$(loc git)  $(git --version 2>/dev/null)"
row python3 "$(loc python3)  $(python3 --version 2>/dev/null)"
row java "$(loc java)  $(java -version 2>&1 | head -1)"
row depot_tools "$([ -d "$HOME/depot_tools" ] && echo "$HOME/depot_tools" || echo MISSING)"
for t in repo gn ninja ccache cros_sdk gclient fetch; do row "tool:$t" "$(loc "$t")"; done

echo; echo "--- AOSP apt packages (source.android.com/docs/setup/start/initializing) ---"
AOSP="git-core gnupg flex bison build-essential zip curl zlib1g-dev libc6-dev-i386 x11proto-core-dev libx11-dev lib32z1-dev libgl1-mesa-dev libxml2-utils xsltproc unzip fontconfig"
amiss=""
for p in $AOSP; do if dpkg -s "$p" >/dev/null 2>&1; then printf '  ok       %s\n' "$p"; else printf '  MISSING  %s\n' "$p"; amiss="$amiss $p"; fi; done
row aosp_missing "${amiss:- none}"

echo; echo "--- ChromiumOS host tools (developer-library) ---"
for p in git gitk git-gui curl util-linux util-linux-extra; do dpkg -s "$p" >/dev/null 2>&1 && printf '  ok       %s\n' "$p" || printf '  MISSING  %s\n' "$p"; done

echo; echo "=== official budgets ==="
row AOSP_ram  ">=64 GB"
row AOSP_disk ">=400 GB (250 checkout + 150 build)"
row AOSP_repo "repo launcher >=2.4"
row AOSP_tc   "OpenJDK/Make/Python3 come prebuilt in the release branch"
row CrOS_disk "practical ~90-120 GB (doc: initial dl ~2GB, pkgs ~3GB, each image <=8GB)"
row CrOS_ram  "many GB (Chrome link 8-28 GB); 45 GB ample"
row CrOS_os   "official Ubuntu 22.04 (Jammy); Debian trixie common"

echo; echo "=== verdict (this vps) ==="
RAMG=$(free -g | awk '/^Mem:/{print $2}')
FREEG=$(df -BG --output=avail "$HOME" 2>/dev/null | tail -1 | tr -dc '0-9')
echo "AOSP:"
[ "${RAMG:-0}" -lt 64 ]  && echo "  BLOCKED  ram ${RAMG}GB < 64GB (under-spec)"  || echo "  ok       ram ${RAMG}GB"
[ "${FREEG:-0}" -lt 400 ] && echo "  BLOCKED  home ${FREEG}GB < 400GB (under-spec)" || echo "  ok       disk ${FREEG}GB"
echo "  repo: via ~/depot_tools or 'apt-get install repo' / manual launcher (NOT installed here)"
echo "ChromiumOS:"
[ "${FREEG:-0}" -lt 120 ] && echo "  TIGHT    disk ${FREEG}GB (plan carefully)" || echo "  FEASIBLE disk ${FREEG}GB (>=~120 GB practical)"
echo "  ok       ram ${RAMG}GB; depot_tools provides repo + cros_sdk"
echo "  note     OS is not Ubuntu 22.04 (official) - verify toolchain compatibility"
echo
echo "# NOT run: apt-get install, repo init/sync, fetch, cros_sdk. Detection only."
