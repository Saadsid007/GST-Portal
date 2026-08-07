#!/usr/bin/env bash
#
# GSTPilot — VPS deploy.
#
# Builds into a timestamped release directory and flips a `current` symlink at
# the end, so a failed build never takes the running site down and a rollback is
# one symlink change. Run as the deploy user, never root.
#
#   ./deploy.sh            deploy origin/main
#   ./deploy.sh v1.4.0     deploy a tag or branch
#
set -Eeuo pipefail

APP_DIR="/var/www/gstpilot"
REPO_DIR="$APP_DIR/repo"
RELEASES_DIR="$APP_DIR/releases"
CURRENT_LINK="$APP_DIR/current"
ENV_FILE="$APP_DIR/shared/.env"
KEEP_RELEASES=5
REF="${1:-origin/main}"

log()  { printf '\n\033[1;34m==>\033[0m %s\n' "$1"; }
fail() { printf '\n\033[1;31mFAILED:\033[0m %s\n' "$1" >&2; exit 1; }

[[ -f "$ENV_FILE" ]] || fail "Missing $ENV_FILE. Create it before deploying."

RELEASE="$RELEASES_DIR/$(date +%Y%m%d%H%M%S)"

log "Fetching $REF"
git -C "$REPO_DIR" fetch --all --prune --tags
git -C "$REPO_DIR" reset --hard "$REF"
COMMIT="$(git -C "$REPO_DIR" rev-parse --short HEAD)"
log "Building commit $COMMIT"

mkdir -p "$RELEASE"
# Copy the worktree rather than building in place: the running release keeps
# serving from its own directory while this one builds.
git -C "$REPO_DIR" archive HEAD | tar -x -C "$RELEASE"

cd "$RELEASE"
ln -sfn "$ENV_FILE" "$RELEASE/.env"

log "Installing dependencies"
pnpm install --frozen-lockfile --prod=false

# Migrations run BEFORE the build and as their own step. `pnpm build` also runs
# `prisma migrate deploy`, but keeping it explicit here means a migration
# failure stops the deploy with an obvious message instead of a confusing build
# error, and the old release is still live.
log "Applying database migrations"
pnpm exec prisma migrate deploy

log "Building"
pnpm exec prisma generate
pnpm exec next build

# Next's standalone output does NOT include public/ or .next/static. Skipping
# this leaves a site with no CSS and no images — the classic standalone
# deployment failure.
log "Staging standalone runtime"
cp -r "$RELEASE/public" "$RELEASE/.next/standalone/public"
mkdir -p "$RELEASE/.next/standalone/.next"
cp -r "$RELEASE/.next/static" "$RELEASE/.next/standalone/.next/static"
ln -sfn "$ENV_FILE" "$RELEASE/.next/standalone/.env"

log "Switching traffic to $COMMIT"
ln -sfn "$RELEASE" "$CURRENT_LINK"

# reload, not restart: PM2 waits for the new process to be up before retiring
# the old one, so in-flight conversions are not killed mid-request.
pm2 reload ecosystem.config.cjs --update-env || pm2 start "$CURRENT_LINK/ecosystem.config.cjs"
pm2 save

log "Pruning old releases (keeping $KEEP_RELEASES)"
cd "$RELEASES_DIR"
ls -1dt */ 2>/dev/null | tail -n +$((KEEP_RELEASES + 1)) | xargs -r rm -rf

log "Deployed $COMMIT"
pm2 status gstpilot
