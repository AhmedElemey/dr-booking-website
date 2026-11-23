# Connected test hosting

Use a Node22 web service, not a static site: this Next.js app uses server rendering, auth cookies and API proxy routes.

- Build: `npm ci && npm run build`
- Start: `npm start -- --hostname 0.0.0.0 --port $PORT`
- `NEXT_PUBLIC_API_BASE_URL`: deployed HTTPS Backend origin, available at build and runtime
- `NEXT_PUBLIC_SITE_URL`: actual HTTPS Website origin
- Leave `MOCK_API` unset. Connected testing must call the deployed Backend.

Set the exact Website origin in the Backend CORS allow-list and update the backend clinic website domain/allowed return hosts only through reviewed changes if payment is later enabled. Payments remain disabled for this test.

Choose Render Free explicitly. New-service form may default to paid compute. No card, no paid add-on, no upgrade. Website shares the workspace's750 free dynamic hours with backend/console. Sleep and quota suspension mean limited test availability.

Validate browser cookies, cross-site POST rejection, doctor listing, login, booking and cancel against the real test Backend before reporting a working link. All data must be synthetic.
