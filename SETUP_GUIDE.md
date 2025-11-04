# Setup Guide: Backend Integration

This guide will help you set up the MongoDB connection and start using the API routes.

## Step 1: Install Dependencies

```bash
npm install mongodb
npm install --save-dev @types/mongodb
```

## Step 2: Configure Environment Variables

1. Copy the example environment file:
   ```bash
   cp .env.local.example .env.local
   ```

2. Edit `.env.local` and add your MongoDB credentials:
   ```env
   MONGODB_URI_COMMON=mongodb+srv://talha:Karachi123@common-central.9hvbzh7.mongodb.net/test?retryWrites=true&w=majority&appName=Common-Central
   MONGODB_URI_STAGING=mongodb+srv://talha:Karachi123@staging-gos.uwyhrpl.mongodb.net/gostesting?retryWrites=true&w=majority&appName=staging-gos
   ```

   **⚠️ Security Note:** In production, use environment variables from your deployment platform (Vercel, etc.) and never commit `.env.local` to git.

## Step 3: Test the Connection

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Test the API endpoint:
   ```
   http://localhost:3000/api/tracks/GP/entries?date=2025-11-02
   ```

   You should get a JSON response with entries for that track and date.

## Step 4: Update Frontend to Use API

Replace static JSON loading with API calls:

**Before (in `lib/ingest.ts`):**
```typescript
export async function loadTrackData(track: string): Promise<TrackData> {
  const response = await fetch(`/v0_${track}_ext.json`);
  return response.json();
}
```

**After:**
```typescript
export async function loadTrackData(track: string, date?: string): Promise<TrackData> {
  const dateParam = date || new Date().toISOString().split('T')[0]; // Today's date
  const response = await fetch(`/api/tracks/${track}/entries?date=${dateParam}`);
  if (!response.ok) {
    throw new Error(`Failed to load ${track} data`);
  }
  return response.json();
}
```

## Step 5: Next Steps

1. **Create more API routes:**
   - `/api/tracks/[track]/results` - Get race results
   - `/api/connections/[track]/[date]` - Get processed connections
   - `/api/matchups` - Generate matchups

2. **Add authentication:**
   - Install NextAuth.js: `npm install next-auth`
   - Follow the NextAuth.js setup guide

3. **Create contest system:**
   - Design contest schema
   - Create contest API routes
   - Build contest UI

## Troubleshooting

### Connection Errors
- Verify MongoDB credentials are correct
- Check that your IP is whitelisted in MongoDB Atlas
- Ensure MongoDB Atlas cluster is running

### API Route Not Found
- Make sure the file is in `app/api/` directory
- Check that the route file is named `route.ts` (Next.js 13+ App Router)

### Type Errors
- Run `npm run typecheck` to see TypeScript errors
- Make sure `@types/mongodb` is installed

## Testing

You can test the API using:

1. **Browser:** Navigate to the URL
2. **curl:**
   ```bash
   curl "http://localhost:3000/api/tracks/GP/entries?date=2025-11-02"
   ```
3. **Postman/Insomnia:** Create a GET request

## Production Deployment

1. **Vercel:**
   - Add environment variables in Vercel dashboard
   - Deploy: `vercel --prod`

2. **Environment Variables:**
   - Add all variables from `.env.local` to your deployment platform
   - Never commit `.env.local` to git

3. **MongoDB Atlas:**
   - Whitelist Vercel's IP ranges (or allow all IPs for testing)
   - Use connection string with username/password

