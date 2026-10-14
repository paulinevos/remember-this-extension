#!/bin/sh
set -eu

cd "${CI_PRIMARY_REPOSITORY_PATH:-$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)}"

if ! command -v node >/dev/null 2>&1 || ! node -e 'const [major, minor] = process.versions.node.split(".").map(Number); process.exit(major > 22 || (major === 22 && minor >= 12) ? 0 : 1)'; then
    brew install node@22
    PATH="$(brew --prefix node@22)/bin:$PATH"
    export PATH
fi

npm ci --no-audit
APP_URL="${APP_URL:-https://remember-this.io}" npm run build:extension
