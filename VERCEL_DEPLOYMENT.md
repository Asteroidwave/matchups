# Vercel Deployment Fix

## Issue
The build was failing because MongoDB connection code was being executed at build time, but environment variables are only available at runtime.

## Solution
1. **Lazy Environment Variable Loading**: Changed MongoDB connection to only check environment variables when functions are called (runtime), not at module load time (build time).

2. **Runtime Checks**: Added runtime checks in API routes to gracefully handle missing environment variables.

## Next Steps

### 1. Add Environment Variables to Vercel

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add the following variables:

```
MONGODB_URI_COMMON=mongodb+srv://talha:Karachi123@common-central.9hvbzh7.mongodb.net/test?retryWrites=true&w=majority&appName=Common-Central

MONGODB_URI_STAGING=mongodb+srv://talha:Karachi123@staging-gos.uwyhrpl.mongodb.net/gostesting?retryWrites=true&w=majority&appName=staging-gos
```

4. Make sure to set them for **Production**, **Preview**, and **Development** environments

### 2. Redeploy

After adding the environment variables, Vercel will automatically trigger a new deployment. The build should now succeed.

## What Changed

- `lib/mongodb/connection.ts`: Environment variables are now checked lazily (only when functions are called)
- `app/api/tracks/[track]/entries/route.ts`: Added runtime check for environment variables with graceful error handling

## Testing Locally

Make sure your `.env.local` file has:
```env
MONGODB_URI_COMMON=...
MONGODB_URI_STAGING=...
```

Then test the API route:
```bash
npm run dev
# Visit: http://localhost:3000/api/tracks/GP/entries?date=2025-11-02
```

