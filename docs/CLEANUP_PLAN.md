# Project Cleanup & Organization Plan

## 🎯 Goals
1. Organize project structure
2. Remove redundant code
3. Consolidate documentation
4. Set up proper Git workflow
5. Enable multi-page testing

---

## 📋 Cleanup Tasks

### Phase 1: Documentation Cleanup

**Move root-level docs to `/docs`:**
```bash
# Files to move
mv BACKEND_SETUP_COMPLETE.md docs/
mv CORRECT_PROGRAM_COLORS.md docs/
mv DEBUG_FRONTEND_BACKEND.md docs/
mv FRONTEND_BACKEND_CONNECTION.md docs/
mv MONGODB_USAGE_OPTIMIZATION.md docs/
mv NEXT_STEPS.md docs/
mv PROGRAM_NUMBER_IMPLEMENTATION.md docs/
mv PROGRAM_NUMBER_VS_POST_POSITION.md docs/
mv PROJECT_CLEANUP_SUMMARY.md docs/
mv QUICK_FIX.md docs/
mv SADDLECLOTH_COLORS_EXPLAINED.md docs/
mv SETUP_GUIDE.md docs/
mv START_HERE.md docs/
mv TESTING_GUIDE.md docs/
mv TESTING_SUMMARY.md docs/
```

**Keep in root:**
- `README.md` (main project readme)
- `.gitignore`
- `package.json`
- Config files (`tsconfig.json`, `next.config.js`, etc.)

**Archive outdated docs:**
```bash
mkdir -p docs/archive
# Move outdated/duplicate docs here
```

### Phase 2: Code Organization

**Create missing folders:**
```bash
mkdir -p lib/services
mkdir -p components/filters
mkdir -p docs/reference/python-scripts
```

**Move Python scripts:**
```bash
mv "other codes"/* docs/reference/python-scripts/
rmdir "other codes"
```

**Remove empty folders:**
```bash
# After verifying they're empty
rmdir lib/calculations 2>/dev/null || true
rmdir lib/mongodb 2>/dev/null || true
```

**Organize legacy code:**
```bash
# Option 1: Archive after porting features
mv legacy/github-main docs/reference/legacy-github-version

# Option 2: Create separate branch
git checkout -b legacy-reference
git add legacy/
git commit -m "Archive legacy GitHub version"
git checkout develop
```

### Phase 3: Git Workflow Setup

**Create proper branch structure:**
```bash
# Ensure develop exists
git checkout develop
git pull origin develop

# Create feature branches
git checkout -b feature/multi-track-support
git checkout -b feature/live-dashboard
git checkout -b feature/multiplier-fix
git checkout -b feature/filtering-enhancements

# Create staging branch
git checkout -b staging
```

**Set up branch protection (GitHub):**
- Protect `main` branch (require PR reviews)
- Allow force push to `develop` (for fast iteration)
- Protect `staging` (require PR reviews)

### Phase 4: Project Structure Improvements

**New structure:**
```
project/
├── app/
│   ├── (auth)/              # Auth route group
│   │   ├── login/
│   │   └── signup/
│   ├── (main)/              # Main app route group
│   │   ├── matchups/        # Main matchups (landing page)
│   │   ├── live/            # Live dashboard
│   │   ├── my-picks/        # User rounds management
│   │   └── results/         # Results page
│   ├── admin/               # Admin routes
│   └── api/                 # Next.js API routes
│
├── components/
│   ├── filters/             # NEW: Filter components
│   │   ├── SearchBar.tsx
│   │   ├── TrackSelector.tsx
│   │   └── TypeSelector.tsx
│   └── [existing folders]
│
├── lib/
│   ├── services/            # NEW: Business logic
│   │   ├── matchupService.ts
│   │   ├── roundService.ts
│   │   └── trackService.ts
│   └── [existing structure]
│
└── docs/
    ├── architecture/        # Architecture docs
    ├── setup/              # Setup guides
    ├── migrations/         # SQL migrations
    ├── reference/          # Reference code
    └── archive/            # Archived docs
```

---

## 🚀 Implementation Steps

### Step 1: Backup Current State
```bash
# Create backup branch
git checkout develop
git checkout -b backup-before-cleanup
git push origin backup-before-cleanup
git checkout develop
```

### Step 2: Documentation Cleanup
```bash
# Run cleanup script (create this)
./scripts/cleanup-docs.sh
```

### Step 3: Code Organization
```bash
# Create new folders
mkdir -p lib/services components/filters docs/reference/python-scripts

# Move files
# [Run manual moves or create script]
```

### Step 4: Update Imports
```bash
# After moving files, update all imports
# Use find/replace or script
```

### Step 5: Test Everything
```bash
# Frontend
npm run dev
npm run build
npm run lint

# Backend
cd backend
npm run dev
npm run build
```

### Step 6: Commit Changes
```bash
git add .
git commit -m "chore: organize project structure and cleanup docs"
git push origin develop
```

---

## 📝 Cleanup Script

Create `scripts/cleanup-project.sh`:

```bash
#!/bin/bash

set -e

echo "🧹 Starting project cleanup..."

# Backup current state
echo "📦 Creating backup branch..."
git checkout -b backup-before-cleanup-$(date +%Y%m%d)
git push origin backup-before-cleanup-$(date +%Y%m%d)
git checkout develop

# Create new directories
echo "📁 Creating new directories..."
mkdir -p lib/services
mkdir -p components/filters
mkdir -p docs/reference/python-scripts
mkdir -p docs/archive

# Move Python scripts
if [ -d "other codes" ]; then
    echo "📦 Moving Python scripts..."
    mv "other codes"/* docs/reference/python-scripts/ 2>/dev/null || true
    rmdir "other codes" 2>/dev/null || true
fi

# Move root-level docs
echo "📄 Moving documentation..."
docs_to_move=(
    "BACKEND_SETUP_COMPLETE.md"
    "CORRECT_PROGRAM_COLORS.md"
    "DEBUG_FRONTEND_BACKEND.md"
    "FRONTEND_BACKEND_CONNECTION.md"
    "MONGODB_USAGE_OPTIMIZATION.md"
    "NEXT_STEPS.md"
    "PROGRAM_NUMBER_IMPLEMENTATION.md"
    "PROGRAM_NUMBER_VS_POST_POSITION.md"
    "PROJECT_CLEANUP_SUMMARY.md"
    "QUICK_FIX.md"
    "SADDLECLOTH_COLORS_EXPLAINED.md"
    "SETUP_GUIDE.md"
    "START_HERE.md"
    "TESTING_GUIDE.md"
    "TESTING_SUMMARY.md"
)

for doc in "${docs_to_move[@]}"; do
    if [ -f "$doc" ]; then
        mv "$doc" docs/
        echo "  ✓ Moved $doc"
    fi
done

# Remove empty folders
echo "🗑️  Removing empty folders..."
rmdir lib/calculations 2>/dev/null || true
rmdir lib/mongodb 2>/dev/null || true

echo "✅ Cleanup complete!"
echo "📝 Review changes with: git status"
echo "🚀 Commit with: git add . && git commit -m 'chore: cleanup project structure'"
```

---

## 🔍 Verification Checklist

After cleanup, verify:

- [ ] All imports still work
- [ ] Frontend builds successfully
- [ ] Backend builds successfully
- [ ] No broken links in documentation
- [ ] Git history preserved
- [ ] All features still work
- [ ] Tests pass (if any)

---

## 📊 Expected Results

**Before:**
- 87 files in `/docs`
- Multiple root-level `.md` files
- Empty folders
- Disorganized structure

**After:**
- Organized `/docs` structure
- Clean root directory
- Proper folder organization
- Clear separation of concerns

---

**Next Steps:** Run cleanup script, test, commit changes
