#!/usr/bin/env bash
set -euo pipefail
vector_build_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)
cd "$vector_build_root"
# This prepares trusted build tools, without setting up an application owner.
npm install --prefix "$vector_build_root/.rer-tools" --no-save --package-lock=false \
  --no-audit --no-fund node@22.20.0 pnpm@10.12.4
export PATH="$vector_build_root/.rer-tools/node_modules/.bin:$PATH"
pnpm install --frozen-lockfile
pnpm exec playwright install --with-deps --only-shell chromium
