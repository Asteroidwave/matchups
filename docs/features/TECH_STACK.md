# Tech Stack Documentation

## Overview
Full-stack horse racing matchups platform with real-time data integration, contest management, and matchup generation.

---

## Frontend

### Framework & Core
- **Next.js 13.5.1** (App Router)
  - Server-side rendering
  - API routes (minimal, most logic in backend)
  - File-based routing

- **React 18.2.0**
  - Functional components with hooks
  - Context API for state management (`AppContext`, `AuthContext`)

- **TypeScript 5.2.2**
  - Strict mode enabled
  - Type safety across codebase

### Styling
- **Tailwind CSS 3.3.3**
  - Utility-first CSS framework
  - Custom theme variables (CSS variables for theming)

- **Tailwind Animate 1.0.7**
  - Custom animations (flash-highlight, flash-outline)

### UI Components
- **Radix UI** (Headless components)
  - Accordion, Alert Dialog, Avatar, Checkbox, Dialog, Dropdown, Select, Tabs, Tooltip, etc.
  - Fully accessible, unstyled primitives

- **Shadcn UI** (Built on Radix)
  - Pre-styled components matching design system
  - Customizable via Tailwind

- **Lucide React 0.446.0**
  - Icon library

### State Management
- **React Context API**
  - `AppContext`: Global app state (connections, matchups, contests, bankroll)
  - `AuthContext`: User authentication and profile

- **Zustand 5.0.8** (Available, but currently using Context)

### Data Fetching
- **Native Fetch API**
  - Backend API calls
  - Retry logic in `lib/api/retry.ts`

### Authentication
- **Supabase Auth**
  - Email/password authentication
  - Session management
  - Protected routes via `ProtectedRoute` component

### Form Handling
- **React Hook Form 7.53.0**
- **Zod 3.23.8** (Schema validation)

### Utilities
- **date-fns 3.6.0** (Date formatting)
- **clsx 2.1.1** (Conditional class names)
- **tailwind-merge 2.5.2** (Merge Tailwind classes)

---

## Backend

### Runtime & Framework
- **Node.js** (Latest LTS)
- **Express 4.18.2**
  - RESTful API
  - CORS enabled
  - JSON body parsing

- **TypeScript 5.3.3**
  - Compiled to JavaScript in `dist/`
  - Type-safe API routes

### Development Tools
- **tsx 4.7.0**
  - TypeScript execution without compilation
  - Used for `dev` script and scripts

### Database Clients
- **MongoDB 6.3.0**
  - Native driver
  - Connection pooling
  - Queries for Equibase race data

- **Supabase JS 2.39.0**
  - PostgreSQL client
  - Row Level Security (RLS)
  - Real-time subscriptions (not yet used)

### Caching
- **Upstash Redis 1.35.6**
  - Cache race entries/results
  - Reduce MongoDB queries
  - TTL-based expiration

### Validation
- **Zod 3.23.8**
  - Request validation
  - Type-safe schemas

### Environment
- **dotenv 16.3.1**
  - Environment variable management

---

## Databases

### MongoDB
**Purpose:** Store Equibase race data (entries, results)

**Collections:**
- Race entries (by track, date)
- Race results (by track, date)

**Connection:**
- URI from `MONGODB_URI_STAGING` or `MONGODB_URI_PROD`
- Connection pooling for performance

**Usage:**
- Read-only for race data
- Cached in Redis to reduce load

### Supabase PostgreSQL
**Purpose:** Store application data (contests, matchups, users, entries)

**Tables:**
- `contests` - Contest definitions
- `matchups` - Generated matchups (stored as JSONB)
- `profiles` - User profiles (bankroll, etc.)
- `entries` - User contest entries
- `tracks` - Track metadata
- `operations` - Admin operation logs

**Features:**
- Row Level Security (RLS) enabled
- Foreign key constraints
- JSONB for flexible data (matchup payloads)

**Connection:**
- Via Supabase JS client
- Environment variables: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

---

## Deployment

### Frontend
- **Platform:** Vercel
- **Build Command:** `npm run build`
- **Output Directory:** `.next`
- **Environment Variables:** Set in Vercel dashboard

### Backend
- **Platform:** Railway (or similar)
- **Build Command:** `npm run build`
- **Start Command:** `npm start`
- **Port:** 3001 (configurable)

---

## Development Workflow

### Local Development
1. **Frontend:**
   ```bash
   npm run dev  # Runs on http://localhost:3000
   ```

2. **Backend:**
   ```bash
   cd backend
   npm run dev  # Runs on http://localhost:3001
   ```

### Environment Variables
**Frontend (.env.local):**
```
NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

**Backend (.env):**
```
PORT=3001
MONGODB_URI_STAGING=...
MONGODB_URI_PROD=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
UPSTASH_REDIS_URL=...
UPSTASH_REDIS_TOKEN=...
```

---

## Dependencies Summary

### Production Dependencies (Frontend)
- Next.js, React, TypeScript
- Tailwind CSS, Radix UI, Shadcn
- Supabase client
- Form handling, validation, date utilities

### Production Dependencies (Backend)
- Express, TypeScript
- MongoDB, Supabase clients
- Upstash Redis
- Zod validation

### Dev Dependencies
- TypeScript compiler
- ESLint (Next.js config)
- tsx (TypeScript execution)

---

## What We Have

✅ **Working:**
- Multi-track data loading
- Matchup generation (single-track and cross-track capable)
- Contest management (admin)
- User authentication
- Entry submission
- Results calculation
- Bankroll management
- Filtering and highlighting (partially)

✅ **Partially Working:**
- Live page (basic structure)
- Multi-select filtering (needs color differentiation)
- Connection modal (needs post time display)

---

## What We're Missing

❌ **Not Yet Implemented:**
- WebSockets for real-time updates (using polling for now)
- Advanced admin analytics
- Email notifications
- Mobile app (web-only currently)
- Advanced search (basic search planned)
- Race time filtering (optional feature)
- Simulation mode (planned)

---

## Version Control

### Git
- **Remote:** `origin https://github.com/Asteroidwave/project.git`
- **Current Branch:** `develop`
- **Branches:** `main`, `develop`, `testing`

### Authentication
- **Method:** HTTPS (may need Personal Access Token for pushes)
- **Status:** Need to verify PAT setup

**To Check:**
```bash
git config --global credential.helper
# Should show helper (e.g., osxkeychain on Mac)

# To set up PAT:
# 1. GitHub → Settings → Developer settings → Personal access tokens
# 2. Generate token with 'repo' scope
# 3. Use token as password when pushing
```

---

## Project Structure

```
project/
├── app/                    # Next.js App Router
│   ├── admin/             # Admin pages
│   ├── matchups/          # Main matchups page
│   ├── live/              # Live progress page
│   ├── results/           # Results page
│   └── api/               # API routes (minimal)
├── backend/               # Express API
│   ├── src/
│   │   ├── routes/        # API endpoints
│   │   ├── services/      # Business logic
│   │   └── utils/         # Utilities (MongoDB, cache, etc.)
│   └── scripts/           # Utility scripts
├── components/            # React components
│   ├── admin/            # Admin components
│   ├── cards/            # Card components
│   ├── modals/           # Modal components
│   └── ui/               # Shadcn UI components
├── contexts/             # React contexts
├── lib/                  # Frontend utilities
├── types/                # TypeScript type definitions
├── docs/                 # Documentation
└── public/               # Static assets
```

---

## Performance Considerations

- **Caching:** Redis for MongoDB queries
- **Code Splitting:** Next.js automatic code splitting
- **Image Optimization:** Next.js Image component (if needed)
- **API Optimization:** Batch requests where possible
- **Database Indexing:** Ensure indexes on frequently queried fields

---

## Security

- **Authentication:** Supabase Auth (secure, managed)
- **API Security:** CORS configured, admin routes protected
- **Database:** RLS enabled on Supabase tables
- **Environment Variables:** Never commit `.env` files
- **Input Validation:** Zod schemas for all user input

---

## Future Considerations

- **Real-time:** WebSockets for live race updates
- **Mobile:** React Native or PWA
- **Analytics:** User behavior tracking
- **Notifications:** Push notifications for race results
- **Internationalization:** Multi-language support (if needed)

---

**Last Updated:** 2025-01-XX

