#!/usr/bin/env bash
#
# GSTPilot: deploy the current commit to the VPS, from this machine.
#
#   bash deploy/push-deploy.sh
#
# Ships the committed tree (git archive, so nothing uncommitted and no local
# .env leaves the machine) over SSH, then builds and switches on the server
# with deploy/build-release.sh. The site stays up on the old release until
# the new one is built and answering.
#
set -Eeuo pipefail

HOST="${DEPLOY_HOST:-root@72.61.238.51}"
KEY="${DEPLOY_KEY:-$HOME/.ssh/gstpilot_vps}"

cd "$(git rev-parse --show-toplevel)"
if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
  echo "Uncommitted changes. Commit first; only committed code is deployed." >&2
  exit 1
fi

SHA="$(git rev-parse --short HEAD)"
RELEASE="/var/www/gstpilot/releases/$(date +%Y%m%d%H%M%S)-$SHA"
echo "Deploying $SHA to $HOST:$RELEASE"

git archive --format=tar HEAD |
  ssh -i "$KEY" -o BatchMode=yes "$HOST" \
    "set -e; mkdir -p '$RELEASE'; tar -x -C '$RELEASE'; bash '$RELEASE/deploy/build-release.sh' '$RELEASE'"
