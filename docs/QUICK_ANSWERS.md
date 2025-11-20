# Quick Answers to Your Questions

## 🔍 What Do We Know About Your Project?

### Tech Stack
- **Frontend:** Next.js 13.5.1, React 18.2, TypeScript 5.2, Tailwind CSS
- **Backend:** Node.js, Express 4.18, TypeScript 5.3
- **Databases:** MongoDB (race data), Supabase PostgreSQL (app data), Upstash Redis (cache)
- **Auth:** Supabase Auth
- **Deployment:** Vercel (frontend), Railway (backend)

### Value We Provide
- Pick'em-style horse racing contests
- Real-time race data from Equibase
- Multi-track support
- Multiple matchup types (Jockeys, Trainers, Sires, Mixed)
- Admin panel for contest management
- Live contest tracking (in development)

### Dependencies
**Frontend:** 75+ packages (Next.js, React, Radix UI, Supabase, etc.)  
**Backend:** 10+ packages (Express, MongoDB, Supabase, Redis, etc.)

### What We Have ✅
- Authentication system
- Admin panel
- Matchups page (basic)
- Backend APIs
- Data pipeline (MongoDB → Supabase)
- Results page

### What We're Missing ❌
- Track selector UI (like Underdog)
- Search functionality
- Multi-select color coding
- "My Picks" page
- Live dashboard UI
- Cross-track matchups
- Simulation mode
- Flex multiplier logic

---

## 🔐 GitHub Connection Status

### Current Setup
- **Remote:** `https://github.com/Asteroidwave/project.git`
- **Auth Method:** HTTPS with macOS Keychain (stored credentials)
- **Status:** ✅ **Working** - Can push/pull successfully
- **Current Branch:** `develop`
- **Branches:** `main` (stable), `develop` (working), `testing` (unused)

### Authentication Details
- Using **HTTPS** (not SSH)
- Credentials stored in **macOS Keychain**
- No PAT needed (using stored credentials)
- Connection is **healthy** ✅

### Recommendation
Consider switching to SSH for better security:
```bash
# Generate SSH key
ssh-keygen -t ed25519 -C "your_email@example.com"

# Add to GitHub: Settings > SSH and GPG keys

# Change remote
git remote set-url origin git@github.com:Asteroidwave/project.git
```

---

## 🌐 Running Multiple Pages Simultaneously

### Yes, You Can! Here's How:

**Option 1: Different Ports (Best for Testing)**
```bash
# Terminal 1: Default frontend (port 3000)
npm run dev

# Terminal 2: Second frontend instance (port 3002)
PORT=3002 npm run dev

# Terminal 3: Backend (port 3001)
cd backend && npm run dev
```

Then open:
- `http://localhost:3000/matchups` (main)
- `http://localhost:3002/admin` (test admin)
- `http://localhost:3001/health` (backend)

**Option 2: Same Port, Different Routes**
Just open multiple browser tabs/windows:
- `http://localhost:3000/matchups`
- `http://localhost:3000/admin`
- `http://localhost:3000/live`
- `http://localhost:3000/results`

**Option 3: Incognito Windows**
- Regular window: logged in as User A
- Incognito window: logged in as User B (or admin)

**Recommendation:** Use Option 1 for testing different features, Option 2 for normal development.

---

## 📁 Project Structure Status

### Current Structure: ⚠️ Needs Organization

**Issues:**
- ❌ 87 files in `/docs` (many outdated)
- ❌ Multiple root-level `.md` files
- ❌ Empty folders (`lib/calculations/`, `lib/mongodb/`)
- ❌ Python scripts in `/other codes/` (should be in docs)
- ❌ Legacy code in `/legacy/` (should be archived)

**Current Layout:**
```
project/
├── app/              ✅ Good (Next.js pages)
├── backend/          ✅ Good (Express API)
├── components/       ✅ Good (React components)
├── lib/              ⚠️ Needs organization
├── docs/             ⚠️ Too many files (87!)
├── legacy/           ⚠️ Should archive after porting
└── other codes/      ❌ Should move to docs/reference
```

### Recommended Structure: ✅ Clean & Organized

```
project/
├── app/
│   ├── (auth)/          # Auth routes
│   ├── (main)/          # Main app routes
│   │   ├── matchups/     # Landing page (no lobby)
│   │   ├── live/         # Live dashboard
│   │   ├── my-picks/     # User rounds
│   │   └── results/      # Results
│   └── admin/           # Admin routes
│
├── components/
│   ├── filters/         # NEW: Filter components
│   └── [existing]
│
├── lib/
│   ├── services/        # NEW: Business logic
│   └── [existing]
│
└── docs/
    ├── architecture/    # Architecture docs
    ├── setup/           # Setup guides
    ├── migrations/      # SQL files
    ├── reference/       # Reference code
    └── archive/         # Old docs
```

**Action Items:**
1. ✅ Move root `.md` files to `/docs`
2. ✅ Archive outdated docs
3. ✅ Move Python scripts to `/docs/reference`
4. ✅ Create `/lib/services/` for business logic
5. ✅ Create `/components/filters/` for filter components
6. ✅ Archive `/legacy/` after porting features

---

## 🎯 Next Steps Summary

### Immediate Actions
1. **Review** `docs/PROJECT_AUDIT.md` (full project analysis)
2. **Review** `docs/CLEANUP_PLAN.md` (cleanup steps)
3. **Decide** on cleanup approach (manual vs script)
4. **Set up** proper Git workflow (branches)

### This Week
1. Clean up project structure
2. Remove lobby, add track selector
3. Port filtering from GitHub repo
4. Add search functionality

### This Month
1. Multi-track support
2. "My Picks" page
3. Live dashboard
4. Simulation mode

---

## 💡 Cursor Pro+ Best Practices

### Recommended Mode Usage

**Chat Mode** (Current):
- ✅ Planning & discussion
- ✅ Quick questions
- ✅ Code review
- ✅ Architecture decisions

**Composer Mode** (For Implementation):
- ✅ Multi-file refactors
- ✅ Feature implementation
- ✅ Code cleanup
- ✅ Large changes

### Workflow
1. **Plan** in Chat Mode (like now)
2. **Implement** in Composer Mode
3. **Debug** in Chat Mode
4. **Review** in Chat Mode

### Pro+ Features to Leverage
- **Codebase Indexing:** Fast context across large codebase
- **Multi-file Edits:** Update related files together
- **Terminal Integration:** Run tests/debug scripts inline
- **Git Integration:** Review diffs, create branches

---

## 📊 Quick Status

| Aspect | Status | Notes |
|--------|--------|-------|
| **GitHub Connection** | ✅ Working | HTTPS with Keychain |
| **Project Structure** | ⚠️ Needs Cleanup | See cleanup plan |
| **Tech Stack** | ✅ Solid | Modern, well-chosen |
| **Dependencies** | ✅ Good | Mostly up-to-date |
| **Documentation** | ⚠️ Too Much | 87 files, many outdated |
| **Code Organization** | ⚠️ Needs Work | Some redundancy |
| **Testing** | ❌ Missing | No tests yet |

---

## 🚀 Ready to Start?

**Recommended Order:**
1. Review audit documents
2. Run cleanup (script or manual)
3. Set up Git branches
4. Start Phase 1 features

**Questions?** Ask in Chat Mode!  
**Ready to code?** Switch to Composer Mode!
