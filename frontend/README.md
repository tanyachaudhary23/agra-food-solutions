# AFS Website (frontend)

The public website and the admin panel for Agra Food Solutions Pvt. Ltd. It is a separate project from the backend (`../backend`): this one shows pages, the backend stores the data.

- **Stack:** Node.js 20.9 or newer (22 recommended), Next.js 16 and React 19 (App Router), TypeScript, Tailwind CSS. Fonts are bundled (nothing is loaded from Google).
- **Public pages:** Home, Products (search and category filter), Product detail, About, Industries, Export Capabilities, Contact / Request a Quote, Privacy, Terms, sitemap, robots.
- **Admin panel (`/admin`):** dashboard, enquiries (status, notes, attachments, CSV export), products (add, edit, photos, specifications, PDFs, drafts, bulk import from Excel or CSV with a preview before saving), categories, settings (all company details), change password.

## 1. Run it on your computer

Start the backend first (see `../backend/README.md`, it runs on port 4000), then:

```bash
cd frontend
cp .env.example .env.local      # Windows Command Prompt: copy .env.example .env.local
npm install
npm run dev                      # http://localhost:3000
```

Admin panel: http://localhost:3000/admin and sign in with the `ADMIN_EMAIL` / `ADMIN_PASSWORD` you gave the backend.

Production check on your computer: `npm run build` then `npm start`.

## 2. Settings (`.env.local`, or your host's "Environment variables")

| Variable | Required? | Meaning |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | **yes** | Address of the deployed backend, no trailing slash, e.g. `https://api.yourdomain.com`. Must match the backend's `PUBLIC_BASE_URL`. |
| `NEXT_PUBLIC_SITE_URL` | **yes** | Address of this website, e.g. `https://www.yourdomain.com`. Used for search-engine links and the sitemap. Must be one of the backend's `FRONTEND_URL` entries. |
| `API_INTERNAL_URL` | no | Private backend address the website server uses (for example inside Docker). Defaults to `NEXT_PUBLIC_API_URL`. |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | no | Cloudflare Turnstile **site** key (free anti-spam). The matching secret key goes in the backend as `TURNSTILE_SECRET_KEY`. |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | no | Privacy-friendly analytics. Loads only after a visitor accepts the cookie banner. |

**Important:** variables starting with `NEXT_PUBLIC_` are fixed into the site when it is **built**. If you change one, rebuild and redeploy the frontend.

## 3. How the two parts connect

```
Visitor's browser --> frontend (this project)  --> backend API --> database + uploaded photos
                  \------ enquiry form posts straight to the backend ------/
```

Set these three to match each other, then it works:

| Frontend | Backend |
| --- | --- |
| `NEXT_PUBLIC_API_URL=https://api.yourdomain.com` | `PUBLIC_BASE_URL=https://api.yourdomain.com` |
| `NEXT_PUBLIC_SITE_URL=https://www.yourdomain.com` | `FRONTEND_URL=https://www.yourdomain.com` (add the version without `www` too if you serve both) |

If the backend is down, the pages show a "temporarily unavailable" message instead of crashing. Changes saved in the admin appear on the public site within about 30 seconds.

## 4. Deploy

Full step by step (domain, hosting, HTTPS, backups, launch checklist): see `DEPLOYMENT.md` in the folder above this one.

Any host that runs Node.js (Vercel, Netlify, Render, Railway, your own server): set the variables above, build command `npm run build`, start command `npm start`. This site needs **no disk and no database of its own**; all data lives in the backend. Point your domain at it and use HTTPS.

After deploying, check: the home page shows the product photos, `/products` lists 90 products, a test enquiry from `/contact` appears in `/admin/enquiries`, and `/sitemap.xml` lists your real domain.

## 5. What you change, and where

You do **not** edit code for content. Sign in to `/admin`:

| What | Where |
| --- | --- |
| Phone, WhatsApp, email, addresses, GST, IEC, year established, certifications | Admin > Settings. Empty fields are hidden on the website, so nothing invented is shown. |
| Which inbox gets enquiries | Admin > Settings > enquiry inbox |
| About story, export terms (Incoterms, payment terms, documents, minimum order) | Admin > Settings |
| Social links | Admin > Settings |
| Privacy Policy and Terms text | Admin > Settings (have it reviewed by a legal professional; a neutral default is shown until you add yours) |
| Product descriptions, specifications, applications, photos, PDF datasheets | Admin > Products > open a product |
| Hide a product without deleting it | Admin > Products, publish switch (draft) |
| Product categories | Admin > Categories |
| Password | Admin > Account |

Things that are in the code (ask a developer, or edit the file):

| What | File |
| --- | --- |
| Home page wording, headline, industries list, navigation | `lib/site.ts`, `app/(site)/page.tsx` |
| Colours and fonts | `tailwind.config.ts`, `app/globals.css` |
| Logo (currently a text mark "AFS") | `components/Header.tsx`, `components/Footer.tsx`, `app/icon.svg` |
| Page titles and descriptions for search engines | each page's `metadata`, products via Admin > Products > SEO |

## 6. Before you launch: checklist

1. Backend deployed with a persistent disk, HTTPS and the settings in its README.
2. Frontend variables set to your real addresses (section 2) and a fresh build made.
3. Send a real test enquiry and confirm the email arrives (use a company-domain mailbox rather than Gmail if you can).
4. Fill Admin > Settings completely and write real descriptions and specifications for products. The catalogue text is a placeholder: "dimensions, materials and grades are confirmed against your enquiry".
5. Replace the catalogue crop photos with original photographs when you have them (Admin > Products). The three large pictures on the home page (`public/home/hero-roller.webp`, `industries-silos.webp`) are illustrative stock-style images: replace them with photos of your own factory, machines or products when you have them (same file names, or edit `app/(site)/page.tsx`).
6. Add reviewed Privacy Policy and Terms. Set `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` only if you want analytics.
7. Turn on Turnstile (site key here, secret in the backend) once the site is public.
8. Change the admin password after first sign-in. Schedule backups of the backend `DATA_DIR`.

## 7. Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| "Products are temporarily unavailable" | The frontend cannot reach the backend: check `NEXT_PUBLIC_API_URL` / `API_INTERNAL_URL`, and that the backend is running. |
| Enquiry form says it could not reach the server, or the browser console shows a CORS error | Backend `FRONTEND_URL` does not exactly match the website address (https, `www`, no trailing slash). |
| Product photos are broken | Backend `PUBLIC_BASE_URL` is still `localhost`. |
| Changed an environment variable and nothing happened | `NEXT_PUBLIC_*` values need a rebuild. |
| Admin keeps returning to the login page | The sign-in lasts 8 hours; sign in again. If it happens immediately, the backend `JWT_SECRET` changed or the API address is wrong. |
