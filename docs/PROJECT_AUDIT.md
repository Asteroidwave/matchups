# Project Audit & Status Report
**Date:** January 2025  
**Project:** Horse Racing Matchups Platform

---

## 🎯 Value Proposition

**What We Provide:**
- **Pick'em-style horse racing contests** where users select winning sets from head-to-head matchups
- **Real-time race data** integration from Equibase (MongoDB) with live updates
- **Multi-track support** - contests can span multiple racetracks
- **Flexible matchup types**: Jockeys vs Jockeys, Trainers vs Trainers, Sires vs Sires, Mixed
- **Admin panel** for contest creation, track management, and matchup generation
- **Live contest tracking** with progress visualization (in development)
- **Bankroll management** with entry fees and winnings

**Target Users:**
- Horse racing enthusiasts
- Fantasy sports players
- Betting/sports contest participants

---

## 🛠️ Tech Stack

### Frontend
- **Framework:** Next.js 13.5.1 (App Router)
- **Language:** TypeScript 5.2.2
- **UI Library:** React 18.2.0
- **Styling:** Tailwind CSS 3.3.3 + shadcn/ui components
- **State Management:** React Context (AppContext, AuthContext) + Zustand 5.0.8
- **Forms:** React Hook Form 7.53.0 + Zod 3.23.8
- **Icons:** Lucide React 0.446.0
- **Date Handling:** date-fns 3.6.0
- **Charts:** Recharts 2.12.7
- **Deployment:** Vercel

### Backend
- **Runtime:** Node.js
- **Framework:** Express 4.18.2
- **Language:** TypeScript 5.3.3
- **Build Tool:** tsx 4.7.0 (dev) / tsc (production)
- **Port:** 3001 (configurable via PORT env var)
- **Deployment:** Railway (or similar)

### Databases
- **MongoDB:** Race entries, results, performance data (Equibase)
- **Supabase (PostgreSQL):** 
  - Contests
  - Matchups
  - User profiles & bankroll
  - Entries
  - Track data metadata
  - Operations/audit log
- **Upstash Redis:** Caching layer for entries, results, contests

### Authentication & Authorization
- **Provider:** Supabase Auth
- **Admin Auth:** Service role key + custom middleware
- **Session Management:** Supabase sessions + custom refresh hooks

### External Services
- **Equibase:** Race data source (via MongoDB)
- **Vercel Analytics:** Usage tracking

---

## 📁 Project Structure

### Current Structure
```
project/
├── app/                          # Next.js App Router pages
│   ├── admin/                   # Admin panel
│   ├── api/                     # Next.js API routes (if any)
│   ├── live/                    # Live dashboard (placeholder)
│   ├── lobby/                   # Contest lobby (to be removed)
│   ├── login/                   # Auth pages
│   ├── matchups/                # Main matchups page
│   ├── results/                 # Results page
│   └── page.tsx                 # Landing page
│
├── backend/                      # Express backend API
│   ├── src/
│   │   ├── routes/              # API route handlers
│   │   │   ├── admin.ts
│   │   │   ├── admin-contests.ts
│   │   │   ├── admin-operations.ts
│   │   │   ├── admin-track-data.ts
│   │   │   ├── connections.ts
│   │   │   ├── contests.ts
│   │   │   ├── entries.ts
│   │   │   ├── health.ts
│   │   │   ├── matchups.ts
│   │   │   └── tracks.ts
│   │   ├── services/            # Business logic
│   │   │   ├── contestLifecycle.ts
│   │   │   ├── matchupCalculation.ts
│   │   │   └── unifiedMatchupGenerator.ts
│   │   ├── utils/               # Utilities
│   │   │   ├── cache.ts
│   │   │   ├── calculations.ts
│   │   │   ├── contests.ts
│   │   │   ├── matchupStats.ts
│   │   │   ├── mergeEntriesWithResults.ts
│   │   │   ├── mongodb.ts
│   │   │   ├── pastRaces.ts
│   │   │   ├── performanceData.ts
│   │   │   ├── programNumberColors.ts
│   │   │   ├── redis.ts
│   │   │   ├── supabase.ts
│   │   │   └── trackDataTransform.ts
│   │   └── index.ts             # Server entry point
│   ├── scripts/                 # Utility scripts
│   └── dist/                    # Compiled output
│
├── components/                   # React components
│   ├── admin/                   # Admin-specific components
│   ├── auth/                    # Auth components
│   ├── cards/                   # Card components
│   ├── layout/                  # Layout components
│   ├── modals/                  # Modal dialogs
│   ├── ui/                      # shadcn/ui components (48 files)
│   └── windows/                 # Window/panel components
│
├── contexts/                     # React contexts
│   ├── AppContext.tsx           # Global app state
│   └── AuthContext.tsx         # Auth state
│
├── lib/                          # Frontend utilities
│   ├── api/                     # API clients
│   ├── auth/                    # Auth utilities
│   ├── calculations/           # (empty - needs organization)
│   ├── mongodb/                 # (empty - needs organization)
│   ├── supabase/                # Supabase client
│   ├── utils/                   # General utilities
│   ├── ingest.ts                # Track data loading
│   ├── matchups.ts              # Client-side matchup generation
│   ├── scoring.ts               # Points calculation
│   ├── store.ts                 # LocalStorage utilities
│   └── tracks.ts                # Track utilities
│
├── types/                        # TypeScript type definitions
│   └── index.ts
│
├── docs/                         # Documentation (87 files!)
│   ├── *.md                     # Markdown docs
│   └── *.sql                    # SQL migrations
│
├── legacy/                       # Reference code from GitHub
│   └── github-main/             # Old working version
│
├── public/                       # Static assets
│   └── data/                    # Static JSON files (old)
│
├── scripts/                      # Frontend utility scripts
│   ├── clear-cache.ts
│   ├── clear-redis.ts
│   ├── clear-tracks-table.ts
│   ├── get-admin-token.js
│   └── test-application.ts
│
└── other codes/                   # Python reference scripts
    ├── PVP.py
    ├── unified_matchup_generator.py
    └── trackresults.py
```

### Structure Issues & Recommendations

**Issues:**
1. **Too many docs** - 87 files in `/docs` (many outdated/duplicate)
2. **Empty folders** - `lib/calculations/`, `lib/mongodb/` are empty
3. **Root-level markdown files** - Should be in `/docs` or removed
4. **Legacy code** - `/legacy/github-main` should be archived or removed after porting
5. **Other codes** - Python scripts should be in `/docs/reference` or separate repo

**Recommended Clean Structure:**
```
project/
├── app/                          # Next.js pages
│   ├── (auth)/                  # Auth routes group
│   │   ├── login/
│   │   └── signup/
│   ├── (main)/                  # Main app routes
│   │   ├── matchups/            # Main matchups page
│   │   ├── live/                # Live dashboard
│   │   ├── my-picks/            # User's rounds
│   │   └── results/             # Results page
│   ├── admin/                   # Admin routes
│   └── api/                     # Next.js API routes
│
├── backend/                      # Express API (keep as-is)
│
├── components/                   # React components
│   ├── admin/                   # Admin components
│   ├── cards/                   # Card components
│   ├── filters/                 # NEW: Filter components
│   ├── layout/                  # Layout components
│   ├── modals/                  # Modal dialogs
│   ├── ui/                      # shadcn/ui
│   └── windows/                 # Panel components
│
├── lib/                          # Frontend utilities
│   ├── api/                     # API clients
│   ├── services/                # NEW: Business logic services
│   │   ├── matchupService.ts
│   │   ├── roundService.ts
│   │   └── trackService.ts
│   ├── utils/                   # General utilities
│   └── [specific files]         # Keep existing
│
├── docs/                         # Documentation (CLEANED)
│   ├── architecture/            # Architecture docs
│   ├── setup/                   # Setup guides
│   ├── migrations/              # SQL migrations
│   └── reference/               # Reference code/docs
│
└── [config files]               # Root config files
```

---

## 🔐 Version Control & GitHub

### Current Status
- **Remote:** `https://github.com/Asteroidwave/project.git`
- **Current Branch:** `develop`
- **Branches:**
  - `main` (stable GitHub version)
  - `develop` (current working branch)
  - `testing` (exists but unused)
- **Auth Method:** macOS Keychain (HTTPS with stored credentials)
- **Connection:** ✅ Working (can push/pull)

### Git Workflow Recommendation

**Branch Strategy:**
```
main                    # Stable, production-ready (current GitHub version)
├── develop             # Integration branch (current work)
│   ├── feature/multi-track-support
│   ├── feature/live-dashboard
│   ├── feature/multiplier-fix
│   └── feature/filtering-enhancements
└── staging             # Pre-production testing
```

**Commands to Set Up:**
```bash
# Ensure develop is up to date
git checkout develop
git pull origin develop

# Create feature branches
git checkout -b feature/multi-track-support
# ... work ...
git checkout develop
git merge feature/multi-track-support

# When ready to merge to main
git checkout main
git merge develop
git push origin main
```

**Authentication:**
- Currently using HTTPS with macOS Keychain
- **Recommendation:** Consider SSH keys for better security:
  ```bash
  # Generate SSH key
  ssh-keygen -t ed25519 -C "your_email@example.com"
  
  # Add to GitHub: Settings > SSH and GPG keys
  
  # Change remote to SSH
  git remote set-url origin git@github.com:Asteroidwave/project.git
  ```

---

## 🚀 Running Multiple Pages Simultaneously

### Current Setup
- **Frontend:** `npm run dev` → `http://localhost:3000`
- **Backend:** `npm run dev` (in `/backend`) → `http://localhost:3001`

### Running Multiple Instances

**Option 1: Different Ports (Recommended)**
```bash
# Terminal 1: Frontend (default port 3000)
cd /Users/briangitonga/Downloads/project
npm run dev

# Terminal 2: Frontend on different port (for testing)
PORT=3002 npm run dev

# Terminal 3: Backend
cd /Users/briangitonga/Downloads/project/backend
npm run dev
```

**Option 2: Multiple Browser Windows/Tabs**
- Same localhost:3000, different routes:
  - `http://localhost:3000/matchups`
  - `http://localhost:3000/admin`
  - `http://localhost:3000/live`
  - `http://localhost:3000/results`

**Option 3: Incognito/Private Windows**
- Open same URL in regular + incognito windows for different sessions

**Recommendation:** Use Option 1 for testing different features simultaneously, Option 2 for normal development.

---

## ✅ What We Have

### Completed Features
1. ✅ **Authentication System**
   - Supabase Auth integration
   - Protected routes
   - Admin authentication
   - Session management

2. ✅ **Admin Panel**
   - Contest creation/management
   - Track data fetching from MongoDB
   - Matchup type selection
   - Matchup generation with settings
   - Track visibility toggle
   - User management

3. ✅ **Matchups Page**
   - Display matchups by type (Jockeys, Trainers, Sires, Mixed)
   - Set selection (A/B)
   - Connection filtering (single-select)
   - Starters panel with horses
   - Connection modal
   - Comparison modal
   - "Your Picks" panel
   - Entry amount input
   - Multiplier display

4. ✅ **Backend APIs**
   - Track data endpoints
   - Connection endpoints
   - Matchup generation
   - Contest management
   - Entry submission
   - Admin operations

5. ✅ **Data Pipeline**
   - MongoDB integration (Equibase data)
   - Supabase integration (app data)
   - Redis caching
   - Track data transformation
   - Connection generation

6. ✅ **Results Page**
   - Round history display
   - Matchup outcomes
   - Points calculation

### Partially Complete
1. ⚠️ **Multi-track Support**
   - Backend can handle multiple tracks
   - Frontend needs track selector UI
   - Cross-track matchups not fully implemented

2. ⚠️ **Live Dashboard**
   - Page exists but placeholder
   - Backend lifecycle service exists
   - Frontend UI not implemented

3. ⚠️ **Filtering**
   - Basic filtering works
   - Multi-select partially implemented
   - Connected Horses button needs fixes
   - Search functionality missing

4. ⚠️ **Multiplier Logic**
   - Display works
   - Calculation needs verification
   - Flex logic needs implementation

---

## ❌ What We're Missing

### Critical Missing Features
1. ❌ **Track Selector UI** (like Underdog's sport selector)
2. ❌ **Search Functionality** for connections
3. ❌ **Multi-select Color Coding** (different colors for Set A vs Set B)
4. ❌ **"My Picks" Page** for round management
5. ❌ **Live Dashboard UI** with progress visualization
6. ❌ **Round Editing/Cancellation** before lock time
7. ❌ **Cross-track Matchup Generation** (admin feature)
8. ❌ **Simulation Mode** for testing with past races
9. ❌ **Flex Multiplier Logic** (backend calculation)
10. ❌ **Post Time Display** in modals

### Infrastructure Missing
1. ❌ **WebSocket/SSE** for live updates
2. ❌ **Background Worker** for race result polling
3. ❌ **Integration Tests**
4. ❌ **E2E Tests**
5. ❌ **CI/CD Pipeline**

### Documentation Missing
1. ❌ **API Documentation** (OpenAPI/Swagger)
2. ❌ **Component Documentation** (Storybook?)
3. ❌ **Deployment Guide** (current one may be outdated)
4. ❌ **Contributing Guide**

---

## 📦 Dependencies Analysis

### Frontend Dependencies (Key)
- **Next.js 13.5.1** - Framework (consider upgrading to 14+)
- **React 18.2.0** - UI library
- **TypeScript 5.2.2** - Type safety
- **Tailwind CSS 3.3.3** - Styling
- **Supabase JS 2.58.0** - Database client
- **Radix UI** - Component primitives (48 components)
- **Zustand 5.0.8** - State management (minimal usage)

### Backend Dependencies (Key)
- **Express 4.18.2** - Web framework
- **MongoDB 6.3.0** - Race data
- **Supabase JS 2.39.0** - App database
- **Upstash Redis 1.35.6** - Caching
- **Zod 3.23.8** - Validation

### Potential Issues
1. **Next.js 13.5.1** - Older version, consider upgrading
2. **Multiple Supabase versions** - Frontend (2.58.0) vs Backend (2.39.0)
3. **Zustand installed but minimal usage** - Consider removing if not needed

---

## 🧹 Cleanup Recommendations

### Immediate Cleanup
1. **Consolidate Documentation**
   - Move all root-level `.md` files to `/docs`
   - Archive outdated docs to `/docs/archive`
   - Keep only essential docs in root: `README.md`, `SETUP_GUIDE.md`

2. **Remove Empty Folders**
   - `lib/calculations/` (empty)
   - `lib/mongodb/` (empty)

3. **Archive Legacy Code**
   - Move `/legacy/github-main` to `/docs/reference/legacy` after porting features
   - Or create separate branch: `git branch legacy-reference`

4. **Organize Python Scripts**
   - Move `/other codes/` to `/docs/reference/python-scripts`

5. **Clean Up Build Artifacts**
   - Ensure `.gitignore` covers all build outputs
   - Remove `tsconfig.tsbuildinfo` from repo (should be gitignored)

### Code Organization
1. **Extract Services**
   - Create `/lib/services/` for business logic
   - Move matchup generation logic from components

2. **Consolidate Utilities**
   - Merge duplicate utility functions
   - Create clear utility modules

3. **Component Organization**
   - Group related components
   - Create `/components/filters/` for filter components

---

## 🎯 Next Steps Priority

### Phase 1: Foundation (Week 1)
1. ✅ Clean up project structure
2. ✅ Set up proper Git workflow
3. ✅ Remove lobby, add track selector
4. ✅ Port filtering from GitHub repo

### Phase 2: Core Features (Week 2-3)
1. ✅ Multi-track support
2. ✅ Search functionality
3. ✅ Multi-select color coding
4. ✅ Fix multiplier/flex logic

### Phase 3: User Experience (Week 4-5)
1. ✅ "My Picks" page
2. ✅ Round management (edit/cancel)
3. ✅ Live dashboard UI
4. ✅ Simulation mode

### Phase 4: Polish (Week 6)
1. ✅ Testing
2. ✅ Documentation
3. ✅ Performance optimization
4. ✅ Deployment

---

## 💡 Cursor Pro+ Best Practices

### Recommended Workflow
1. **Planning Phase** (Chat Mode)
   - Discuss architecture
   - Plan features
   - Review code

2. **Implementation Phase** (Composer Mode)
   - Multi-file refactors
   - Feature implementation
   - Code cleanup

3. **Debugging Phase** (Chat Mode)
   - Quick fixes
   - Error resolution
   - Code review

### Leverage Pro+ Features
- **Codebase Indexing:** Fast context across large codebase
- **Multi-file Edits:** Update related files together
- **Terminal Integration:** Run tests/debug scripts inline
- **Git Integration:** Review diffs, create branches

### Tips
- Use Composer for large refactors (removing lobby, adding track selector)
- Use Chat for quick questions and clarifications
- Leverage codebase search for finding related code
- Use terminal for running tests and scripts

---

## 📊 Project Health Score

| Category | Score | Notes |
|---------|-------|-------|
| **Code Organization** | 6/10 | Needs cleanup, some redundancy |
| **Documentation** | 4/10 | Too many docs, many outdated |
| **Test Coverage** | 2/10 | Minimal/no tests |
| **Type Safety** | 8/10 | Good TypeScript usage |
| **Architecture** | 7/10 | Solid separation, some coupling |
| **Git Workflow** | 7/10 | Good branch structure, needs cleanup |
| **Dependencies** | 7/10 | Mostly up-to-date, some version mismatches |
| **Deployment** | 6/10 | Set up but needs documentation |

**Overall:** 5.9/10 - Good foundation, needs organization and testing

---

## 🔗 Quick Reference

### Important Files
- **Frontend Entry:** `app/layout.tsx`
- **Backend Entry:** `backend/src/index.ts`
- **Main Matchups Page:** `app/matchups/page.tsx`
- **App Context:** `contexts/AppContext.tsx`
- **Auth Context:** `contexts/AuthContext.tsx`

### Key Environment Variables
- `NEXT_PUBLIC_BACKEND_URL` - Backend API URL
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key
- `MONGODB_URI_STAGING` - MongoDB connection
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase admin key
- `UPSTASH_REDIS_REST_URL` - Redis URL
- `UPSTASH_REDIS_REST_TOKEN` - Redis token

### Development Commands
```bash
# Frontend
npm run dev              # Start Next.js dev server
npm run build           # Build for production
npm run lint            # Run ESLint

# Backend
cd backend
npm run dev             # Start Express dev server
npm run build           # Build TypeScript
npm run check-contest   # Debug script

# Git
git checkout develop    # Switch to develop branch
git status              # Check changes
git add .               # Stage changes
git commit -m "..."     # Commit
git push origin develop # Push to GitHub
```

---

**Last Updated:** January 2025  
**Next Review:** After Phase 1 completion
