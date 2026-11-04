#!/usr/bin/env bash
#
# GSTPilot: build and switch to a release that is already unpacked on the VPS.
# Called by push-deploy.sh; can also be run by hand:
#
#   bash /var/www/gstpilot/releases/<dir>/deploy/build-release.sh /var/www/gstpilot/releases/<dir>
#
# The VPS is shared with other apps, so everything here stays inside
# /var/www/gstpilot and uses GSTPilot's own Node at /opt/gstpilot-node.
# The running release keeps serving until the new one has built; if the new
# one does not answer after the switch, the previous release is restored.
#
set -Eeuo pipefail

RELEASE="${1:?usage: build-release.sh <release-dir>}"
APP_DIR="/var/www/gstpilot"
ENV_FILE="$APP_DIR/shared/.env"
CURRENT_LINK="$APP_DIR/current"
KEEP_RELEASES=5
PORT=3100

export PATH="/opt/gstpilot-node/bin:$PATH"
# Keep the build from crowding out the other apps on this box.
export NODE_OPTIONS="--max-old-space-size=3072"
# Version skew: a tab opened before this deploy gets a full reload on its next
# navigation instead of mixing old and new code. (Server Action IDs themselves
# stay stable across deploys through NEXT_SERVER_ACTIONS_ENCRYPTION_KEY in
# shared/.env.)
export NEXT_DEPLOYMENT_ID="$(basename "$RELEASE")"

log()  { printf '\n\033[1;34m==>\033[0m %s\n' "$1"; }
fail() { printf '\n\033[1;31mFAILED:\033[0m %s\n' "$1" >&2; exit 1; }

[[ -f "$ENV_FILE" ]] || fail "Missing $ENV_FILE"
cd "$RELEASE"
ln -sfn "$ENV_FILE" .env

log "Installing dependencies"
nice -n 10 pnpm install --frozen-lockfile --prod=false

log "Applying database migrations"
pnpm exec prisma migrate deploy

log "Building"
nice -n 10 pnpm build

log "Staging standalone runtime"
# Next's standalone output leaves out public/ and .next/static.
rm -rf .next/standalone/public
cp -r public .next/standalone/public
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/static
ln -sfn "$ENV_FILE" .next/standalone/.env
mkdir -p /var/log/gstpilot

PREVIOUS="$(readlink -f "$CURRENT_LINK" || true)"
log "Switching to $(basename "$RELEASE")"
ln -sfn "$RELEASE" "$CURRENT_LINK"
cd "$CURRENT_LINK"
if pm2 describe gstpilot >/dev/null 2>&1; then
  pm2 reload ecosystem.config.cjs --update-env
else
  pm2 start ecosystem.config.cjs
fi

log "Health check"
for _ in $(seq 1 20); do
  sleep 2
  if [[ "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/")" == "200" ]]; then
    pm2 save >/dev/null
    log "Live: $(basename "$RELEASE")"
    cd "$APP_DIR/releases"
    ls -1dt */ | tail -n +$((KEEP_RELEASES + 1)) | xargs -r rm -rf
    exit 0
  fi
done

if [[ -n "$PREVIOUS" && -d "$PREVIOUS" ]]; then
  ln -sfn "$PREVIOUS" "$CURRENT_LINK"
  cd "$CURRENT_LINK" && pm2 reload ecosystem.config.cjs --update-env
  fail "New release did not answer on :$PORT. Rolled back to $(basename "$PREVIOUS")."
fi
fail "New release did not answer on :$PORT and there is no previous release."
