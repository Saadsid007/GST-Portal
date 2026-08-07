# Deploying GSTPilot to a Hostinger VPS

End-to-end: fresh Ubuntu VPS → PostgreSQL → app under PM2 → Nginx → HTTPS on your
Hostinger domain → Razorpay webhooks → backups.

Every command below is meant to be pasted in order. Anything you must change is
written as `REPLACE_…`.

---

## Before you start

|            |                                                                                         |
| ---------- | --------------------------------------------------------------------------------------- |
| **VPS**    | Hostinger KVM 2 or better. **2 GB RAM minimum** — see [Swap](#13-swap-required-on-2-gb) |
| **OS**     | Ubuntu 24.04 LTS (24.04 or 22.04 both fine)                                             |
| **Domain** | Registered/managed in Hostinger                                                         |
| **Local**  | Your machine, with the repo pushed to GitHub                                            |

Two decisions to make now:

**1. Where does PostgreSQL live?**
This guide installs Postgres **on the VPS** (Section 4). If you already use Neon
(your current `DATABASE_URL`), you can skip Section 4 entirely and keep using it —
it is a perfectly good choice and removes backup work from your plate. Everything
else is identical.

**2. Read this before you touch anything**
`NEXT_PUBLIC_*` variables are **compiled into the JavaScript bundle at build
time**, not read at runtime. Changing `NEXT_PUBLIC_APP_URL` or
`NEXT_PUBLIC_RAZORPAY_KEY_ID` requires a **rebuild**, not a restart. This catches
almost everyone once.

---

## 1. Point the domain at the VPS

Do this first — DNS takes time to propagate, and certificate issuance in
Section 8 will fail until it has.

1. Hostinger **hPanel → VPS → your server** — copy the **IPv4 address**.
2. Hostinger **Domains → your domain → DNS / Nameservers → Manage DNS records**.
3. Create or edit:

| Type | Name  | Points to        | TTL  |
| ---- | ----- | ---------------- | ---- |
| `A`  | `@`   | `REPLACE_VPS_IP` | 3600 |
| `A`  | `www` | `REPLACE_VPS_IP` | 3600 |

Delete any pre-existing `A`/`CNAME` on `@` or `www` pointing at Hostinger's
parking page, or they will win.

Check propagation from your own machine:

```bash
dig +short REPLACE_DOMAIN
```

Do not continue past Section 7 until that prints your VPS IP.

---

## 2. First login and hardening

SSH in as root using the password from hPanel:

```bash
ssh root@REPLACE_VPS_IP
```

### 2.1 Update the system

```bash
apt update && apt upgrade -y
apt install -y curl git ufw fail2ban unzip ca-certificates
```

### 2.2 Create a deploy user

Never run the app as root. If the app is compromised, root means the whole box.

```bash
adduser --gecos "" deploy
usermod -aG sudo deploy
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy
```

### 2.3 Key-based SSH only

From **your local machine** (not the VPS):

```bash
ssh-keygen -t ed25519 -C "gstpilot-deploy"        # skip if you already have a key
ssh-copy-id deploy@REPLACE_VPS_IP
ssh deploy@REPLACE_VPS_IP                          # confirm it works before the next step
```

Once key login works, back on the VPS as root:

```bash
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart ssh
```

> Keep your current session open while you test a second SSH connection. If you
> lock yourself out, hPanel's browser console is the way back in.

### 2.4 Firewall

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
ufw status verbose
```

**Port 5432 is deliberately not opened.** Postgres listens on localhost only.
The repo's `docker-compose.yml` maps `5432:5432` — that file is for local
development. Do not use it on the VPS without removing that mapping.

---

## 3. Node, pnpm, PM2

The app requires **Node ≥ 20** and uses **pnpm 11.18.0** via corepack.

```bash
# as deploy
sudo -i -u deploy

curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

sudo corepack enable
corepack prepare pnpm@11.18.0 --activate

sudo npm install -g pm2
pm2 install pm2-logrotate          # otherwise logs grow until the disk fills

node -v && pnpm -v && pm2 -v
```

---

## 4. PostgreSQL on the VPS

_Skip this whole section if you are staying on Neon._

```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable --now postgresql
```

Create the database and a least-privilege user:

```bash
sudo -u postgres psql <<'SQL'
CREATE USER gstpilot WITH PASSWORD 'REPLACE_STRONG_DB_PASSWORD';
CREATE DATABASE gstpilot OWNER gstpilot;
GRANT ALL PRIVILEGES ON DATABASE gstpilot TO gstpilot;
\c gstpilot
GRANT ALL ON SCHEMA public TO gstpilot;
SQL
```

Confirm it only listens locally — this should print `127.0.0.1` or `localhost`:

```bash
sudo -u postgres psql -tAc "SHOW listen_addresses;"
```

Your connection string will be:

```
postgresql://gstpilot:REPLACE_STRONG_DB_PASSWORD@localhost:5432/gstpilot?schema=public
```

---

## 5. Directory layout

Releases are timestamped and `current` is a symlink. A failed build never takes
the live site down, and rollback is one symlink change.

```bash
sudo mkdir -p /var/www/gstpilot/{repo,releases,shared}
sudo mkdir -p /var/log/gstpilot
sudo chown -R deploy:deploy /var/www/gstpilot /var/log/gstpilot
```

```
/var/www/gstpilot
├── repo/        bare-ish clone, only used as a build source
├── releases/    20260806T1200/, 20260806T1830/, …
├── shared/.env  the real secrets, never in git, survives deploys
└── current ->   releases/<newest>
```

---

## 6. Clone and configure

```bash
git clone https://github.com/REPLACE_GH_USER/GST-Portal.git /var/www/gstpilot/repo
cd /var/www/gstpilot/repo
```

> **Private repo?** Generate a deploy key on the VPS with
> `ssh-keygen -t ed25519 -f ~/.ssh/id_deploy -N ""`, add
> `~/.ssh/id_deploy.pub` to GitHub → repo → _Settings → Deploy keys_ (read-only),
> then clone the `git@github.com:` URL.

### 6.1 Generate the auth secret

```bash
openssl rand -base64 32
```

### 6.2 Write the environment file

```bash
nano /var/www/gstpilot/shared/.env
```

```dotenv
# --- Application ---
NODE_ENV="production"
# Must be the exact public origin, https, no trailing slash.
# Baked into the client bundle at build time — changing it needs a rebuild.
NEXT_PUBLIC_APP_URL="https://REPLACE_DOMAIN"

# --- Database ---
DATABASE_URL="postgresql://gstpilot:REPLACE_STRONG_DB_PASSWORD@localhost:5432/gstpilot?schema=public"

# --- Auth (better-auth) ---
BETTER_AUTH_SECRET="REPLACE_WITH_OPENSSL_OUTPUT"
BETTER_AUTH_URL="https://REPLACE_DOMAIN"

# --- Logging ---
LOG_LEVEL="info"

# --- Razorpay ---
# Live keys from the Razorpay dashboard. The webhook secret is set in Section 9.
RAZORPAY_KEY_ID="rzp_live_REPLACE"
RAZORPAY_KEY_SECRET="REPLACE"
RAZORPAY_WEBHOOK_SECRET="REPLACE_AFTER_SECTION_9"
NEXT_PUBLIC_RAZORPAY_KEY_ID="rzp_live_REPLACE"

# --- First admin (used only by `pnpm db:seed`) ---
ADMIN_SEED_EMAIL="you@REPLACE_DOMAIN"
ADMIN_SEED_PASSWORD="REPLACE_STRONG_PASSWORD"
```

Lock it down — it holds your database password and payment secrets:

```bash
chmod 600 /var/www/gstpilot/shared/.env
```

`src/lib/env.ts` validates these with Zod at startup. A missing or malformed
value fails loudly on boot rather than at 2am mid-payment.

---

## 7. First deploy

```bash
chmod +x /var/www/gstpilot/repo/deploy/deploy.sh
cp /var/www/gstpilot/repo/deploy/deploy.sh /var/www/gstpilot/deploy.sh
/var/www/gstpilot/deploy.sh
```

The script clones the commit into a new release, installs, **runs migrations**,
builds, stages the standalone runtime, flips `current`, and reloads PM2.

### What it does that you must not skip if deploying by hand

Next's `output: "standalone"` build does **not** include `public/` or
`.next/static`. Running `node .next/standalone/server.js` without copying them
gives you a site with **no CSS and no images** — this is the single most common
Next standalone deployment failure:

```bash
cp -r public .next/standalone/public
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/static
```

### Create the first admin

```bash
cd /var/www/gstpilot/current
pnpm db:seed
```

Then **remove `ADMIN_SEED_PASSWORD` from `.env`** and change the password from
Settings after your first sign-in.

### Start on boot

```bash
pm2 startup systemd -u deploy --hp /home/deploy    # run the command it prints
pm2 save
```

Confirm the app answers locally before Nginx is involved:

```bash
curl -I http://127.0.0.1:3000
```

---

## 8. Nginx and HTTPS

```bash
sudo apt install -y nginx
sudo cp /var/www/gstpilot/current/deploy/nginx/gstpilot.conf \
        /etc/nginx/sites-available/gstpilot
sudo sed -i 's/REPLACE_DOMAIN/REPLACE_DOMAIN/g' /etc/nginx/sites-available/gstpilot
sudo ln -sf /etc/nginx/sites-available/gstpilot /etc/nginx/sites-enabled/gstpilot
sudo rm -f /etc/nginx/sites-enabled/default

sudo nginx -t && sudo systemctl reload nginx
```

`http://REPLACE_DOMAIN` should now serve the site.

### Certificate

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d REPLACE_DOMAIN -d www.REPLACE_DOMAIN \
     --redirect --agree-tos --no-eff-email -m you@REPLACE_DOMAIN
```

`--redirect` makes certbot add the port-80 → 443 redirect for you.

Renewal is installed automatically. Prove it works rather than assuming:

```bash
sudo certbot renew --dry-run
systemctl list-timers | grep certbot
```

### Two settings that will bite you if skipped

Both are already in the shipped config, but if you write your own Nginx file:

- **`client_max_body_size 30M`** — `next.config.ts` allows 25 MB Server Action
  bodies because a multi-marketplace upload really is that big. Nginx defaults
  to **1 MB** and returns 413 before Next sees the request.
- **`proxy_read_timeout 180s`** — the default 60s cuts off long conversions.

---

## 9. Razorpay webhooks

Settlement is idempotent and driven by the webhook, so this is not optional —
without it, a UPI payment credits only if the user keeps the QR dialog open.

1. Razorpay Dashboard → **Settings → Webhooks → Add New Webhook**
2. **URL:** `https://REPLACE_DOMAIN/api/webhooks/razorpay`
3. **Secret:** generate one (`openssl rand -hex 32`) and paste it in
4. **Active events:** `payment.captured`, `payment.failed`, `order.paid`,
   `qr_code.credited`
5. Put that same secret in `.env` as `RAZORPAY_WEBHOOK_SECRET`, then redeploy:

```bash
/var/www/gstpilot/deploy.sh
```

The route is whitelisted in `middleware.ts` and authenticated purely by an HMAC
over the **raw** body, so nothing between Razorpay and Next may rewrite it —
which is why the shipped Nginx config disables request buffering on
`/api/webhooks/`.

Verify from the Razorpay dashboard's webhook log that deliveries return **2xx**.

---

## 10. Redeploying

```bash
/var/www/gstpilot/deploy.sh              # deploy origin/main
/var/www/gstpilot/deploy.sh v1.4.0       # deploy a tag
```

### Rollback

```bash
ls -1dt /var/www/gstpilot/releases/*/    # newest first
ln -sfn /var/www/gstpilot/releases/REPLACE_TIMESTAMP /var/www/gstpilot/current
pm2 reload gstpilot
```

Rollback does **not** revert database migrations. If a release added a migration,
roll the schema back deliberately or forward-fix — never assume the symlink flip
undid it.

---

## 11. Backups

Skip this and you will eventually lose customer wallet balances.

```bash
sudo mkdir -p /var/backups/gstpilot && sudo chown deploy:deploy /var/backups/gstpilot
cat > /home/deploy/backup-db.sh <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail
STAMP=$(date +%F-%H%M)
OUT="/var/backups/gstpilot/gstpilot-$STAMP.sql.gz"
pg_dump "postgresql://gstpilot:REPLACE_STRONG_DB_PASSWORD@localhost:5432/gstpilot" | gzip > "$OUT"
find /var/backups/gstpilot -name '*.sql.gz' -mtime +14 -delete
echo "backup written: $OUT"
EOF
chmod +x /home/deploy/backup-db.sh
chmod 700 /home/deploy/backup-db.sh     # it contains the DB password

( crontab -l 2>/dev/null; echo "30 2 * * * /home/deploy/backup-db.sh >> /var/log/gstpilot/backup.log 2>&1" ) | crontab -
```

**A backup you have never restored is not a backup.** Test it:

```bash
sudo -u postgres createdb restore_test
gunzip -c /var/backups/gstpilot/REPLACE_FILE.sql.gz | sudo -u postgres psql restore_test
sudo -u postgres psql -d restore_test -c '\dt'
sudo -u postgres dropdb restore_test
```

Copies on the same disk die with the disk. Sync them off-box:

```bash
# Hostinger object storage, S3, Backblaze, or simply another machine
rsync -az /var/backups/gstpilot/ REPLACE_USER@REPLACE_HOST:/backups/gstpilot/
```

---

## 12. Day-to-day operations

```bash
pm2 status                      # is it up
pm2 logs gstpilot --lines 100   # app logs (Pino JSON)
pm2 monit                       # live CPU / memory
pm2 reload gstpilot             # zero-downtime restart

sudo tail -f /var/log/nginx/error.log
sudo systemctl status nginx postgresql

df -h && free -h                # disk and memory
```

Logs are Pino JSON. To read them comfortably:

```bash
pm2 logs gstpilot --raw | npx pino-pretty
```

---

## 13. Swap (required on 2 GB)

`next build` is memory-hungry. On a 2 GB box it will be OOM-killed mid-build,
usually presenting as a build that dies with no error.

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h
```

If a build still dies, build with more headroom:

```bash
NODE_OPTIONS="--max-old-space-size=2048" pnpm exec next build
```

---

## 14. Troubleshooting

| Symptom                                   | Cause                                                           | Fix                                             |
| ----------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------- |
| Site loads but **no CSS/images**          | `public/` and `.next/static` not copied into `.next/standalone` | Section 7                                       |
| **413** on upload                         | Nginx `client_max_body_size` defaults to 1 MB                   | Section 8                                       |
| Long conversions **502 after ~60s**       | `proxy_read_timeout` default                                    | Section 8                                       |
| Sign-in loops / cookie not set            | `X-Forwarded-Proto` missing, or `BETTER_AUTH_URL` is `http://`  | Section 8 + `.env`                              |
| Changed `NEXT_PUBLIC_*`, nothing happened | Baked in at build time                                          | Redeploy, don't restart                         |
| UPI paid, credits missing                 | Webhook not configured or returning non-2xx                     | Section 9                                       |
| Build dies silently                       | OOM                                                             | Section 13                                      |
| `certbot` fails                           | DNS not propagated, or port 80 blocked                          | Section 1, `ufw status`                         |
| Prisma `TableDoesNotExist`                | Migrations never ran                                            | `cd current && pnpm exec prisma migrate deploy` |

---

## 15. Post-launch checklist

- [ ] `https://REPLACE_DOMAIN` loads with a valid padlock
- [ ] `http://` redirects to `https://`
- [ ] `www` and apex both work
- [ ] Sign up, sign in, sign out
- [ ] `pnpm db:seed` admin can reach `/admin`
- [ ] A conversion completes and all three files download
- [ ] A ₹1 live UPI recharge credits the wallet
- [ ] Razorpay dashboard shows **2xx** webhook deliveries
- [ ] `curl -s https://REPLACE_DOMAIN/robots.txt` and `/sitemap.xml` return sensibly
- [ ] `sudo certbot renew --dry-run` passes
- [ ] Backup cron has produced a file, and you have restored one
- [ ] `ADMIN_SEED_PASSWORD` removed from `.env`
- [ ] `ufw status` shows only OpenSSH + Nginx Full

---

## Appendix — Docker alternative

The repo ships a `Dockerfile`, but note two things before using it:

1. `pnpm build` runs `prisma migrate deploy`, so building the image requires a
   reachable database. For image builds you want migrations as a **separate
   step at release time**, not baked into the build.
2. `docker-compose.yml` publishes `5432:5432`. That is fine locally; on a public
   VPS remove the `ports:` mapping so Postgres stays on the Docker network.

PM2 is recommended on small Hostinger plans — building images on a 2 GB box is
slower and heavier than building the app directly, and PM2 gives you the same
zero-downtime reload with far less moving machinery.
