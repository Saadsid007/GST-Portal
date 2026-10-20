# GSTPilot — Vercel Deployment Guide

Yeh guide zero se production tak le jaata hai: database, environment variables, Vercel deploy, aur Cloudflare R2 storage.

---

## 0. Pehle yeh samajh lo — storage abhi zaroori NAHI hai

Maine code check kiya. Abhi pura convert pipeline **in-memory** chalta hai:

- User file upload karta hai → Server Action mein `File` object jaata hai
- `XLSX.read()` usse RAM mein parse karta hai
- Result `conversion_history` table mein **JSON** ke roop mein save hota hai (`json_payload`, `normalized_data`)
- Original Excel file kahin store nahi hoti

Codebase mein `@aws-sdk`, `S3Client`, ya koi bhi R2 call **nahi hai**. `.env.example` mein `STORAGE_*` variables placeholder hain, `src/lib/env.ts` unhe read tak nahi karta.

**Iska matlab:** Section 1–5 follow karke aaj hi deploy kar sakte ho. Cloudflare R2 (Section 6) tab karna jab tum original files ko archive karna chaaho (GST audit trail ke liye — 6 saal record rakhna padta hai, toh eventually zaroorat padegi).

---

## 1. Kya kya chahiye — checklist

| Cheez                   | Kahaan se                         | Cost                | Zaroori?  |
| ----------------------- | --------------------------------- | ------------------- | --------- |
| GitHub account          | github.com                        | Free                | Haan      |
| Vercel account          | vercel.com                        | Free (Hobby)        | Haan      |
| PostgreSQL database     | Neon / Supabase / Vercel Postgres | Free tier available | Haan      |
| `BETTER_AUTH_SECRET`    | Khud generate karoge              | Free                | Haan      |
| Cloudflare account + R2 | cloudflare.com                    | Free 10 GB          | Baad mein |
| Custom domain           | Kahin se bhi                      | ~₹800/saal          | Optional  |

---

## 2. Database setup

### Konsa provider chuno

**Supabase, region South Asia (Mumbai)** — Vercel ka function region bhi Mumbai (bom1) hai, isliye
server aur database ek hi shehar mein: har query ~1–3 ms. Neon ka koi Mumbai region nahi hai (sabse
paas Singapore, ~60–110 ms per query), isliye GSTPilot Oct 2026 mein Neon se Supabase pe shift hua.

### Supabase steps

1. supabase.com → New project → region **South Asia (Mumbai)**, password sirf letters aur digits.
2. **Project Settings → Data API → disable.** App seedha Prisma se judta hai; REST API on rehne se
   `public` tables public key se padhi ja sakti hain. (Saari tables pe RLS bhi on hai — dono parat.)
3. **Connect** se do strings copy karo:
   - **Transaction pooler** (port **6543**) → Vercel mein `DATABASE_URL` — app isse chalti hai
   - **Session pooler** (port **5432**) → Vercel mein `DIRECT_URL` — build ke `prisma migrate deploy`
     ke liye (transaction pooler migration ka advisory lock nahi pakad sakta). `prisma.config.ts`
     `DIRECT_URL` ho to wahi use karta hai, warna `DATABASE_URL`.

   ```
   DATABASE_URL="postgresql://postgres.<ref>:PASSWORD@aws-0-ap-south-1.pooler.supabase.com:6543/postgres"
   DIRECT_URL="postgresql://postgres.<ref>:PASSWORD@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"
   ```

   Password mein special character ho to URL-encode karo (`@` → `%40`, `#` → `%23`), aur
   `[YOUR-PASSWORD]` ke brackets hata do.

**Note:** purani migrations khaali database se poora schema nahi banati (`payment` table pehle
`db push` se bani thi). Naya database banana ho to schema purane database se lo
(`prisma migrate diff --from-empty --to-config-datasource --script`), migrations se nahi.

### Migration file

Maine `prisma/migrations/0_init/migration.sql` bana diya hai (pehle migrations folder khaali tha — Vercel pe build fail ho jaata).

Ab `package.json` mein yeh change kiye:

```json
"postinstall": "prisma generate",
"build": "prisma migrate deploy && next build"
```

- `postinstall` isliye chahiye kyunki `src/generated/` gitignored hai — Vercel ko har build pe Prisma client dobara generate karna padega
- `build` mein `migrate deploy` isliye taaki har deploy pe schema apne aap sync ho jaaye

**Pehli baar local se test karo:**

```bash
npx prisma migrate deploy
```

Agar yeh success ho gaya toh Vercel pe bhi chalega.

---

## 3. Environment variables — poori list

Yeh values `src/lib/env.ts` se nikali hain (Zod schema). Sirf yeh 6 actually padhi jaati hain.

### Required (inke bina app crash hoga)

| Variable              | Value                              | Kahaan se milegi                            |
| --------------------- | ---------------------------------- | ------------------------------------------- |
| `DATABASE_URL`        | `postgresql://...?sslmode=require` | Neon dashboard → Connection string (pooled) |
| `BETTER_AUTH_SECRET`  | 32-byte random string              | Neeche command se generate karo             |
| `BETTER_AUTH_URL`     | `https://your-app.vercel.app`      | Vercel deploy ke baad milega                |
| `NEXT_PUBLIC_APP_URL` | `https://your-app.vercel.app`      | Same as upar                                |

### Optional (default value hai)

| Variable    | Default       | Kya karo                                                     |
| ----------- | ------------- | ------------------------------------------------------------ |
| `NODE_ENV`  | `development` | Vercel apne aap `production` set karta hai — **mat chhedo**  |
| `LOG_LEVEL` | `info`        | Production mein `info` theek hai, debug karna ho toh `debug` |

### Secret generate karna

Git Bash mein:

```bash
openssl rand -base64 32
```

Output aisa dikhega: `k3Jm9xQp2Lw8vNrT5hYbZc7Fd1Ge4Ai6Ou0Ss3Pe8U=`

Yeh `BETTER_AUTH_SECRET` mein daalo. **Kisi ke saath share mat karo, GitHub pe commit mat karo.** Agar leak ho jaaye toh naya generate karke Vercel mein badal do — sab users logout ho jaayenge, aur kuch nahi bigdega.

### Jo variables `.env.example` mein hain lekin abhi kaam nahi karte

`STORAGE_*`, `AI_PROVIDER`, `AI_API_KEY`, `EMAIL_*` — yeh sab placeholder hain. `env.ts` mein defined hi nahi hain, toh Vercel mein daalne ki abhi zaroorat nahi. Jab feature banega tab schema mein add karenge.

---

## 4. Vercel pe deploy

### Step 1 — GitHub pe push

Repo abhi tak commit nahi hua hai (`git status` mein sab untracked tha). Pehle:

```bash
git add . && git commit -m "Initial commit" && git branch -M main
```

Phir GitHub pe naya repo banao (**Private** rakhna) aur:

```bash
git remote add origin https://github.com/<tumhara-username>/gst-portal.git && git push -u origin main
```

**Check karo:** `.env` push na ho jaaye. `.gitignore` mein already hai, lekin `git status` chalake confirm kar lena.

### Step 2 — Vercel import

1. https://vercel.com → GitHub se sign up
2. "Add New" → "Project" → apna repo select karo
3. Settings jo Vercel apne aap detect karega:
   - Framework: **Next.js** ✓
   - Build Command: `pnpm build` ✓ (yeh ab migrate + build dono karega)
   - Install Command: `pnpm install` ✓

   Kuch change karne ki zaroorat nahi.

4. **Environment Variables** section kholo, yeh 4 daalo:

   ```
   DATABASE_URL       = postgresql://...pooler...?sslmode=require
   BETTER_AUTH_SECRET = <openssl wala output>
   BETTER_AUTH_URL    = https://placeholder.vercel.app
   NEXT_PUBLIC_APP_URL= https://placeholder.vercel.app
   ```

   URL abhi pata nahi hai — placeholder daal do, deploy ke baad theek karenge.

5. "Deploy" dabao

### Step 3 — URL fix karo

Deploy ke baad Vercel real URL dega, jaise `gst-portal-abc123.vercel.app`.

Settings → Environment Variables → `BETTER_AUTH_URL` aur `NEXT_PUBLIC_APP_URL` dono ko us URL se replace karo → phir **Deployments → ... → Redeploy**.

Yeh step skip mat karna. Galat `BETTER_AUTH_URL` hone se login cookies set nahi hongi aur user login karke bhi logged out dikhega.

### Step 4 — Verify

- `https://your-app.vercel.app` khulna chahiye
- Signup karke dekho → Neon dashboard → Tables → `user` table mein row aani chahiye
- Ek sample file convert karke dekho

---

## 5. Deploy ke baad — dhyan rakhne wali cheezein

### Serverless timeout

Vercel Hobby plan pe Server Action ki max duration **10 seconds** hai (Pro pe 60s, configure karke 300s).

Tumhara convert pipeline 10-stage ka hai. 5 files ka batch process karne mein zyada time lag sakta hai. Agar timeout aaye toh:

- Pro plan (~$20/month) lo, ya
- Bade batches ko background job mein move karo

Abhi ke liye chhote batches se test karo aur dekho kitna time lagta hai.

### Body size limit

Maine `next.config.ts` mein `serverActions.bodySizeLimit: "25mb"` set kiya hai. **Lekin Vercel ka apna platform-level limit 4.5 MB hai** request body pe — usse upar nahi jaa sakte chahe config mein kuch bhi likho.

Agar users 4.5 MB se badi files daalein, toh unhe pehle browser se seedha R2 pe upload karna hoga (Section 6 wala presigned URL flow).

### Region

Vercel Settings → Functions → Region → **Mumbai (bom1)** set karo, taaki function aur database (Supabase Mumbai) ek hi shehar mein rahein. Default US hai jisse har DB query pe ~200ms extra lagega.

### Migrations ka dhyan

`build` script har deploy pe `migrate deploy` chalata hai. Schema change karo toh:

```bash
npx prisma migrate dev --name <kya-change-kiya>
```

Yeh naya migration file banayega — usse commit karna **mat bhoolna**, warna production ka schema purana reh jaayega.

---

## 6. Cloudflare R2 storage (jab zaroorat pade)

### Kab karna hai

Jab tum chaaho ki:

- Original marketplace Excel files archive rahein (GST record 6 saal rakhne ka rule hai)
- 4.5 MB se badi files upload ho sakein
- Generated GSTR-1 Excel files download link se milein

Abhi in mein se kuch nahi ho raha, isliye yeh section baad ke liye hai.

### R2 kyun (S3 nahi)

R2 ka **egress free** hai — matlab file download karne ka paisa nahi lagta. S3 mein har GB download pe charge hota hai. Excel files baar baar download hongi, toh R2 sasta padega. Free tier: 10 GB storage + 10 million reads/month.

### Setup steps

1. https://dash.cloudflare.com → sign up
2. Left sidebar → **R2** → "Purchase R2" (card add karna padega, lekin free tier ke andar charge nahi hoga)
3. "Create bucket" → naam `gstpilot-uploads` → Location: **APAC**
4. R2 main page → "Manage R2 API Tokens" → "Create API Token"
   - Permissions: **Object Read & Write**
   - Specify bucket: `gstpilot-uploads`
   - TTL: Forever
5. Token banne ke baad yeh 3 cheezein dikhengi — **sirf ek baar dikhti hain, abhi copy kar lo**:
   - Access Key ID
   - Secret Access Key
   - Endpoint (`https://<account-id>.r2.cloudflarestorage.com`)

### Code mein kya add karna hoga

**a. Package:**

```bash
pnpm add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

**b. `src/lib/env.ts` mein schema extend karo** (yaad rahe — `process.env` direct kabhi nahi, hamesha `env.ts` se):

```ts
STORAGE_ENDPOINT: isServer ? z.string().min(1) : z.string().optional(),
STORAGE_ACCESS_KEY_ID: isServer ? z.string().min(1) : z.string().optional(),
STORAGE_SECRET_ACCESS_KEY: isServer ? z.string().min(1) : z.string().optional(),
STORAGE_BUCKET: isServer ? z.string().min(1) : z.string().optional(),
```

...aur neeche `envSchema.parse({...})` object mein bhi inhe map karna.

**c. Naya file `src/lib/storage.ts`** — S3Client ko R2 endpoint ke saath configure karo, `region: "auto"` rakhna.

**d. Vercel mein 4 naye env vars** add karke redeploy.

### Bade files ka flow (presigned upload)

4.5 MB limit bypass karne ke liye file server se hoke nahi jaani chahiye:

1. Browser Server Action ko file ka **naam** bhejta hai
2. Server presigned PUT URL banata hai (5 min valid) aur wapas bhejta hai
3. Browser **seedha R2 pe** `fetch(url, { method: "PUT", body: file })` karta hai — Vercel bypass
4. Browser server ko batata hai ki upload ho gaya, server R2 se file padhkar pipeline chalata hai

Iske liye `step-upload.tsx` aur `convert.actions.ts` dono badalne padenge.

---

## 7. Troubleshooting

| Error                                                         | Wajah                                                              | Fix                                                                |
| ------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| `Cannot find module '@/generated/prisma/client'`              | `postinstall` nahi chala                                           | `package.json` mein `"postinstall": "prisma generate"` check karo  |
| `Can't resolve '@/generated/prisma'` (Turbopack, Vercel only) | Directory import — generated folder ka koi `package.json` nahi hai | `@/generated/prisma/client` se import karo, bare directory se nahi |
| `DATABASE_URL is not set`                                     | Vercel mein variable nahi hai                                      | Settings → Env Vars → add → redeploy                               |
| `no pg_hba.conf entry`                                        | SSL missing                                                        | Connection string ke end mein `?sslmode=require` lagao             |
| Login hota hai par turant logout                              | `BETTER_AUTH_URL` galat                                            | Real Vercel URL daalo, `https://` ke saath, end mein `/` nahi      |
| `Too many connections`                                        | Direct connection use ho raha hai                                  | Pooled URL use karo (`-pooler` wala)                               |
| `FUNCTION_INVOCATION_TIMEOUT`                                 | 10s limit                                                          | Chhote batches, ya Pro plan                                        |
| `Request Entity Too Large`                                    | File > 4.5 MB                                                      | Vercel platform limit — R2 presigned flow chahiye                  |

---

## 8. Ek known issue

`pnpm lint` abhi **toot-ta hai**: `typescript-eslint` (v8.65) TypeScript 7.0 ko support nahi karta.

Vercel ka build isse affect nahi hoga (build sirf `next build` chalata hai, lint nahi). Lekin GitHub Actions CI mein lint step hai toh woh red dikhega. Do options: typescript-eslint ka naya version aane ka wait karo, ya TypeScript 5.x pe wapas jao.
