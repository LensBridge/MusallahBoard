#!/usr/bin/env bash
# Sign the Vite build (dist/) into the board app package and write the channel
# pointer boards poll (agent/docs/architecture.md, sections 4 and 9.4):
#
#   release/musallahboard-app-<version>.mbu
#   release/app-channel.json   {"version","url","sha256","bytes"}
#
# The package is built by the agent repo's `mbpack`, the same code the agent
# verifies it with. Run `npm run build` first (`npm run package` does both).
#
#   MB_RELEASE_SIGNING_KEY  base64 of the 32-byte Ed25519 release seed. Required.
#   MB_RELEASE_BASE_URL     where the .mbu is downloaded from; default the
#                           GitHub release for v<version>.
#
# Install mbpack with Go (the pinned ref lives in .github/workflows/release.yml):
#   go install github.com/LensBridge/agent/cmd/mbpack@<commit>
set -euo pipefail
cd "$(dirname "$0")/.."

command -v mbpack >/dev/null || { echo "package.sh: mbpack is not on PATH (see the comment at the top of this file)" >&2; exit 1; }
[ -f dist/index.html ] || { echo "package.sh: dist/ holds no build; run npm run build first" >&2; exit 1; }

version="$(node -p "require('./package.json').version")"
out="${1:-release}"
name="musallahboard-app-${version}.mbu"
base="${MB_RELEASE_BASE_URL:-https://github.com/LensBridge/MusallahBoard/releases/download/v${version}}"

mkdir -p "$out"
mbpack app --version "$version" --local-api 2 --key-env MB_RELEASE_SIGNING_KEY dist -o "$out/$name"

cat > "$out/app-channel.json" <<JSON
{
  "version": "${version}",
  "url": "${base%/}/${name}",
  "sha256": "$(sha256sum "$out/$name" | cut -d' ' -f1)",
  "bytes": $(stat -c %s "$out/$name")
}
JSON
cat "$out/app-channel.json"
