# Environment Variables Summary

## Frontend (`/.env.local`)
**Status:** ✅ All required variables are set

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xdvtdifqcukahmzcbent.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=***
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
```

Used by the Next.js app (file lives at project root).

---

## Backend (`/backend/.env`)
**Status:** ⚠️ Supabase service-role variables still missing

Currently set:
```bash
MONGODB_URI_COMMON=mongodb+srv://...
UPSTASH_REDIS_REST_URL=https://welcome-oryx-6721.upstash.io
UPSTASH_REDIS_REST_TOKEN=ARpB...
PORT=3001
CORS_ORIGIN=http://localhost:3000
```

### Required Supabase variables
```bash
SUPABASE_URL=https://xdvtdifqcukahmzcbent.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```
1. Go to Supabase Dashboard → Settings → API.
2. Copy the `service_role` key (keep it secret!).
3. Add the vars above to `/backend/.env`.
4. Restart the backend (`cd backend && npm run dev`).

You should now see `Supabase backend client initialized` instead of the warning about missing env vars.

---

## MongoDB (Performance Metrics)
Multi-track and high-quality single-track matchups pull AVPA stats (Talha’s calculations) from Mongo.  
If you don’t configure Mongo locally, the generator now falls back to salary/apps only but you’ll lose some “famous name” weighting.

Recommended env vars:
```bash
MONGODB_URI_COMMON=mongodb+srv://<user>:<pass>@<cluster>/<db>
MONGODB_URI_STAGING=mongodb+srv://<user>:<pass>@<cluster>/<db>
MONGODB_DB_COMMON=test         # or whichever DB stores equibase data
MONGODB_DB_STAGING=gostesting  # or your staging DB
```

Don’t have creds yet? No problem—the new fallback keeps everything running (you’ll just see a one-time warning). Ask your teammate for read-only Mongo access when you want the exact production-quality tiers.

---

## Supabase Connection Help
I can’t connect to your Supabase project directly, but I can help by:
- Debugging console/network errors you share.
- Providing SQL scripts for fixes.
- Reviewing env files for mistakes.

Never share secrets (service-role keys, passwords, API keys). Blur sensitive data before posting screenshots.

---

## Current Status
- Frontend Supabase: **WORKING**
- Backend Supabase: **MISSING** (add vars above)
- MongoDB: **OPTIONAL** (fallback now supported)
- Redis: **WORKING**

Most 500s you’ve seen are from RLS policies or missing env vars. Fixing the Supabase/Mongo configs above will prevent the admin features (contest calc + multi-track bundles) from hanging.