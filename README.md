# moonlight-website

Public website for Moonlight, a dentist reservation platform. Next.js 16 (App Router), TypeScript, Tailwind CSS and `next-intl` with `/ar` (default, RTL) and `/en` routes. The product spec lives in [moonlight-backend/docs/SPEC.md](https://github.com/AhmedElemey/moonlight-backend/blob/main/docs/SPEC.md).

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
- Demo mode: `MOCK_API=1 npm run dev` (or `MOCK_API=1 npx next build && MOCK_API=1 npx next start -p 3100`) serves in-memory fixtures instead of the backend; OTP code `123456`. Off by default.

Use Tailwind logical utilities (`ms-*`, `ps-*`, `start-*`) so layouts flip correctly in RTL.
