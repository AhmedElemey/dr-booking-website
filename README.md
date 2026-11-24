# dr-booking-website

Public website for Dr booking, a dentist reservation platform. Next.js 16 (App Router), TypeScript, Tailwind CSS and `next-intl` with `/ar` (default, RTL) and `/en` routes. The product spec lives in [dr-booking-backend/docs/SPEC.md](https://github.com/AhmedElemey/dr-booking-backend/blob/main/docs/SPEC.md).

## Develop

```bash
npm ci
npm run dev        # http://localhost:3000 → redirects to /ar
npx eslint
npm run typecheck
npm test           # Vitest
npm run build
```

- Translations: `messages/{ar,en}.json`
- Locale routing: `src/i18n/` and `src/proxy.ts`
- Public config: `.env.development` / `.env.production` (`NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_SITE_URL`). No secrets go in these files.
- Demo mode: `MOCK_API=1 npm run dev` (or `MOCK_API=1 npx next build && MOCK_API=1 npx next start -p 3100`) serves in-memory fixtures instead of the backend; OTP code `123456`. Off by default. In demo mode all 13 phase-2 features are on (override with `MOCK_FEATURES='{"reviews":false}'`); the demo clock-dependent video visit opens 15 minutes before its start.

## Backend settings the website depends on

Set these on the Dr booking API (`dr-booking-backend`), not here:

- `Payments__PublicBaseUrl` (required): the public origin of the API. Without it the Mock payment provider builds `checkoutUrl` from the request host, which behind an internal API URL (for example `http://api:8080` in Docker) is unreachable from the patient's browser.
- Return URL allow-list: the site sends `<origin>/<locale>/appointments/<id>?payment=return` as `returnUrl`, built from the browser's origin. The API accepts only hosts listed in `Payments__ReturnUrlHosts__N` plus `website.domain` from its `clinic.config.json` (the `www.` variant is accepted too). List every other host the site is served from, or paying answers `400 returnUrl is not on the allow-list`.
- Record attachments are no longer public `/uploads` files. `attachmentUrl` is an API path that needs the patient's bearer token; the site opens it through its proxy (`GET /api/me/records/<id>/attachment`, GET only), so a signed-in patient can open it.

Use Tailwind logical utilities (`ms-*`, `ps-*`, `start-*`) so layouts flip correctly in RTL.
