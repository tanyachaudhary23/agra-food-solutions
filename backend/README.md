# AFS Backend (API + database)

The server behind the Agra Food Solutions website. It stores the product catalogue, the company's contact details and every
enquiry, sends enquiry emails, and provides the secure admin login. The website (frontend) is a separate project that talks to this API.

- **Stack:** Node.js **22 or newer** (check with `node -v`; download from nodejs.org), Express 5, TypeScript, SQLite (one database file), nodemailer for email.
- **Status:** all endpoints below are implemented and tested (35 automated checks, see "Testing").
- **The admin screens (the pages you click in) are part of the frontend**, which is the next step. Until then you can run and test this backend with the commands below.

---

## 1. Run it on your computer

```bash
cd backend
cp .env.example .env        # Windows Command Prompt: copy .env.example .env
```

Open `.env` and set at least:

```
ADMIN_EMAIL=you@yourcompany.com
ADMIN_PASSWORD=a-long-password-of-10-or-more-characters
```

Then:

```bash
npm install
npm run dev                 # starts on http://localhost:4000
```

On the very first start it automatically:
1. creates the database file `data/afs.db`,
2. loads the **90 products, 8 categories and their photos** from the company catalogue,
3. creates your admin account from `ADMIN_EMAIL` / `ADMIN_PASSWORD` (you can delete `ADMIN_PASSWORD` from `.env` afterwards).

Check it works: open http://localhost:4000/api/health (should show `{"ok":true}`) and http://localhost:4000/api/products.

Commands: `npm run dev` (development), `npm run build` then `npm start` (production), `npm run seed`, `npm run create-admin -- email 'password'`, `npm run backup`.

---

## 2. The database (read this part)

### What it is
**SQLite**: the whole database is **one file**, `afs.db`, inside the folder set by `DATA_DIR` (default `./data`). There is **no database server to install, pay for or configure**. The file and all its tables are created automatically on first start. SQLite comfortably handles a site like this (hundreds of products, many thousands of enquiries).

### What is stored where

```
DATA_DIR/
  afs.db                  <- the database (products, categories, enquiries, settings, admin login)
  uploads/public/         <- product photos and PDF documents (shown on the website)
  uploads/private/        <- files that buyers attach to enquiries (never public; admin only)
  backups/                <- copies made by "npm run backup"
```

| Table | Holds |
| --- | --- |
| `products` | name, slug (web address), category, descriptions, specifications, applications, variants, photos, documents, featured, published/draft, SEO text |
| `categories` | the 8 product categories (name, description, order) |
| `enquiries` | every enquiry from the website form: buyer details, message, status (new / in progress / quoted / closed), your notes, whether the email was sent |
| `settings` | contact details, WhatsApp, GST/IEC/CIN, about text, export terms, social links, privacy and terms text, enquiry inbox |
| `admins` | admin email + **hashed** password (the real password is never stored) |

### How the data gets in and out
- **Day to day you never touch the file.** Products, categories, settings and enquiries are managed through the admin panel (frontend step).
- **To look at the raw data**, install the free program "DB Browser for SQLite" and open `afs.db` (read it while the server is stopped, or just look, don't edit).
- **Enquiries are saved to the database first, then emailed.** If email is misconfigured or the mail server is down, the buyer still gets "thank you" and you lose nothing: the enquiry sits in the admin panel flagged "email failed".

### The most important rule when you deploy
**The `DATA_DIR` folder must be on persistent storage.** Many hosts wipe the server's disk on every redeploy or restart (this is normal for free tiers). If `DATA_DIR` is on such a disk, **you will lose every enquiry, every product edit and every uploaded photo.** Use a host plan that offers a persistent disk/volume and mount it at `DATA_DIR` (Docker image: `/data`).

Also: **run only one copy of the backend** against one database file.

### Backups (do this from day one)
```bash
npm run backup            # development
npm run backup:prod       # production (after npm run build)
```
This writes a safe copy of the database to `DATA_DIR/backups/afs-YYYYMMDD-HHMM.db` (the newest 14 are kept) and works while the server is running. The photos in `uploads/` are not inside that file, so **copy the whole `DATA_DIR` folder somewhere else regularly** (another disk, cloud storage). A backup that only lives on the same server is not a backup.

Example daily backup on a Linux server (cron): `0 2 * * * cd /path/to/backend && npm run backup:prod`

### Restore
1. Stop the server. 2. Replace `DATA_DIR/afs.db` with the backup copy (also delete `afs.db-wal` and `afs.db-shm` if present). 3. Restore the `uploads/` folder if it was lost. 4. Start the server.

### Starting over
Delete the whole `DATA_DIR` folder and start the server: you get a fresh database with the catalogue reloaded. **This erases all enquiries and edits.** The catalogue is only auto-loaded when the database has no categories, so it never overwrites your changes on a normal restart.

### Moving to a bigger database later (PostgreSQL)
Not needed now. It becomes worth it only if you run several servers at once or expect heavy traffic. The database code is concentrated in `src/db.ts`, `src/products.ts`, `src/settings.ts` and the two files in `src/routes/`, so a move is a contained piece of work but **not a switch you can flip**: it needs a developer.

---

## 3. Settings (`.env` file or your host's "Environment variables")

| Variable | Required? | What it does |
| --- | --- | --- |
| `PORT` | no (4000) | Port the server listens on (hosts often set this for you) |
| `PUBLIC_BASE_URL` | **yes in production** | The public address of this backend, e.g. `https://api.yourdomain.com`. **Product image links are built from it: if it still says localhost, images break on the live site.** |
| `FRONTEND_URL` | **yes in production** | The website address(es) allowed to use this API, comma separated, exact: `https://www.yourdomain.com,https://yourdomain.com`. Anything else is blocked (so the enquiry form fails if this is wrong). |
| `JWT_SECRET` | **yes in production** | A long random string that signs admin logins. Generate: `openssl rand -hex 32`. Keep it secret; changing it logs everyone out. |
| `DATA_DIR` | no (`./data`) | Folder for database and uploads. **Must be persistent storage in production.** |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | first start only | Creates the first admin account when none exists. Later changes to these are ignored: change the password inside the admin panel (Account page) or run `npm run create-admin -- email 'newpassword'` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | for email | Mail server login. Gmail: `smtp.gmail.com`, `587`, the Gmail address, a 16-character **App Password** (no spaces; normal password does not work) |
| `ENQUIRY_FROM_EMAIL` | for email | Sender address: must be the mailbox you log in with (Gmail rewrites any other) |
| `ENQUIRY_TO_EMAIL` | for email | Inbox that receives enquiries. Can be changed later in admin Settings without redeploying |
| `TURNSTILE_SECRET_KEY` | optional | Cloudflare Turnstile (free CAPTCHA) secret key. Recommended once the site is public |
| `TRUST_PROXY` | no | Number of proxies in front of the server (default 1 in production, 0 locally). Needed so rate limits see the visitor's real IP |

If email variables are missing the server still works: enquiries are saved and visible in admin, and the log says "email delivery NOT configured".

---

## 4. Deploy it

You need: a host that runs Node.js (or Docker), **a persistent disk**, and HTTPS. Use a separate address for the API, e.g. `api.yourdomain.com`.

**Any host that runs Node 22 or newer:** `npm ci`, `npm run build`, start with `npm start`. Set the variables above and mount the persistent disk at the path you give `DATA_DIR`.

**Docker (any host or your own server):**
```bash
docker build -t afs-backend .
docker run -d --name afs-backend --restart unless-stopped -p 4000:4000 -v afs-data:/data --env-file .env afs-backend
```
The volume `afs-data` keeps the database and uploads. (The image has been checked by reproducing its build steps; it was not built with Docker itself in the development environment, so run it once and check `/api/health` before launch.)

**Your own Linux server with HTTPS (Caddy gets the certificate automatically):**
```
api.yourdomain.com {
    reverse_proxy localhost:4000
}
```

After deploying: open `https://api.yourdomain.com/api/health` and `/api/products`. Both must work from the internet.

---

## 5. API reference

Public (the website uses these): `GET /api/health`, `/api/categories`, `/api/products`, `/api/products/:slug`, `/api/settings`, `POST /api/enquiries` (form-data; honeypot, rate limit 6 per 10 min per IP, optional Turnstile, one attachment up to 5 MB: pdf, png, jpg, dwg, dxf, doc, docx, xls, xlsx, checked by file contents not just name).

Admin (needs `Authorization: Bearer <token>` from `POST /api/admin/login`; only failed logins count toward the limit of 10 per 15 min): `GET /me`, `POST /password`, `GET /stats`, `POST /upload/image` (re-encoded to WebP, max 1600 px), `POST /upload/document` (PDF), `/categories`, `/products` (create, edit, delete, drafts), `/settings`, `/enquiries` (search, status, notes, attachment download, delete), `GET /enquiries.csv`. **Recycle bin:** `DELETE /enquiries/:id` only moves an enquiry to the bin; `GET /enquiries?view=deleted` lists the bin; `POST /enquiries/:id/restore` brings one back; `DELETE /enquiries/:id/permanent` empties one from the bin immediately. Enquiries (and their attachments) are removed for good 30 days after deletion, checked at server start and hourly.

**Catalogue PDF** (`GET /api/catalogue.pdf`) is built from your live published products and Settings. To put your logo on the cover, add a light or transparent PNG at `assets/logo.png` (create the `assets` folder next to `src`); without it the cover shows the text wordmark. Website links and the QR code appear only when `FRONTEND_URL` is your real domain. Export terms, certifications and an About paragraph print when filled in under Admin > Settings.

Security built in: hashed passwords, signed 8-hour login tokens, CORS limited to your website, security headers (helmet), input validation on every field, uploads checked by content, private enquiry files never publicly served, spreadsheet-formula-safe CSV export.

---

## 6. Testing

With the server running: `ADMIN_EMAIL=... ADMIN_PASSWORD=... npm test` (needs bash, curl, python3 with Pillow). It runs 35 checks: login, drafts hidden from the public, enquiry validation and fake-file rejection, attachments private, uploads, settings, CORS, password change, malformed requests, path-traversal attempts. It changes data (creates and deletes a test product, adds test enquiries), so run it on a test copy, not on your live database.

---

## 7. What you need to supply or change before launch (backend side)

1. **Hosting with a persistent disk** and the API address (e.g. `api.yourdomain.com`).
2. **Set the variables in section 3**: especially `PUBLIC_BASE_URL`, `FRONTEND_URL`, `JWT_SECRET`, admin login, email login.
3. **A company-domain email** (e.g. `enquiries@yourdomain.com`) for sending and receiving enquiries is strongly recommended over Gmail. Only the SMTP variables change.
4. **A scheduled backup** copying `DATA_DIR` off the server.
5. **Content, entered through the admin panel (frontend step)**, none of which I can invent:
   - For each of the 90 products: a real description, specifications (size, material, grade…), applications, and ideally an original photograph (the current photos are small crops from your PDF catalogue).
   - Settings: WhatsApp number, GST number, IEC (import-export code), year established, "about us" story, certifications (only real ones), export terms (Incoterms, payment terms, documents, minimum order), social media links.
   - Privacy Policy and Terms text, reviewed by a legal professional.
6. The starting contact details (Gmail address, two mobile numbers, landline, both addresses, CIN) were copied from your catalogue cover. They are in `src/settings.ts` (`defaultSettings`) and only used on the first start; afterwards change them in admin Settings.

---

## 8. Troubleshooting

| Message | Meaning and fix |
| --- | --- |
| `JWT_SECRET must be set in production` | Add `JWT_SECRET` (see section 3) |
| Enquiry form says "Origin not allowed" / blocked in the browser | `FRONTEND_URL` doesn't exactly match the website address (check `https`, `www`, no trailing slash) |
| Product images missing on the live site | `PUBLIC_BASE_URL` is still `localhost` or wrong |
| Email `ENOTFOUND` / certificate name mismatch | Typo in `SMTP_HOST` (it is `smtp.gmail.com`) |
| Email `534 Application-specific password required` | Gmail needs an App Password (Google Account, Security, 2-Step Verification on, then App passwords) |
| Everything resets after a redeploy | `DATA_DIR` is not on persistent storage |
| `Too many login attempts` | 10 wrong passwords: wait 15 minutes |
| Forgot admin password | `npm run create-admin -- you@yourcompany.com 'new-long-password'` on the server |
