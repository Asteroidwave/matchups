# Project Structure

## 📁 Folder Organization

```
project/
├── app/                    # Next.js App Router pages
│   ├── layout.tsx         # Root layout with navigation
│   ├── page.tsx           # Landing page
│   ├── matchups/          # Matchups page
│   │   └── page.tsx
│   └── results/           # Results page
│       └── page.tsx
│
├── components/            # React components
│   ├── cards/            # Card components
│   │   ├── ConnectionCard.tsx
│   │   ├── MatchupCard.tsx
│   │   ├── SetCard.tsx
│   │   └── SetStats.tsx
│   │
│   ├── layout/           # Layout components
│   │   └── Navigation.tsx
│   │
│   ├── modals/           # Modal components
│   │   ├── CompareModal.tsx
│   │   ├── ConnectionModal.tsx
│   │   ├── MatchupModal.tsx
│   │   └── RaceDetailModal.tsx
│   │
│   ├── ui/               # shadcn/ui components
│   │   └── [all UI components]
│   │
│   └── windows/          # Window components
│       └── StartersWindow.tsx
│
├── contexts/             # React Context providers
│   └── AppContext.tsx
│
├── lib/                  # Utility functions and business logic
│   ├── ingest.ts        # Data loading and merging
│   ├── matchups.ts      # Matchup generation
│   ├── scoring.ts       # Scoring calculations
│   ├── store.ts         # LocalStorage persistence
│   └── utils.ts         # General utilities
│
├── types/               # TypeScript type definitions
│   └── index.ts
│
├── public/              # Static assets
│   ├── v0_BAQ_ext.json # Track data files
│   ├── v0_GP_ext.json
│   ├── v0_KEE_ext.json
│   └── v0_SA_ext.json
│
└── [config files]       # package.json, tsconfig.json, etc.
```

## 🗂️ Component Organization

### Cards (`components/cards/`)
- **ConnectionCard**: Displays individual connection information
- **MatchupCard**: Shows a matchup with Set A vs Set B
- **SetCard**: Displays a set of connections
- **SetStats**: Aggregated statistics for sets with 2+ connections

### Modals (`components/modals/`)
- **ConnectionModal**: Detailed connection view with past performance
- **MatchupModal**: Detailed matchup breakdown
- **RaceDetailModal**: Complete race results
- **CompareModal**: Side-by-side connection comparison

### Windows (`components/windows/`)
- **StartersWindow**: Left panel showing race starters with filtering

### Layout (`components/layout/`)
- **Navigation**: Top navigation bar with routing

## 📦 Business Logic (`lib/`)

- **ingest.ts**: Loads and merges JSON track data into unified connections
- **matchups.ts**: Generates balanced matchups with salary constraints
- **scoring.ts**: Calculates points, AVPA, and matchup winners
- **store.ts**: Handles localStorage persistence for rounds and bankroll

## 🧹 Cleaned Up

✅ Removed duplicate JSON files from root
✅ Removed unused `matchups-v2/` directory
✅ Removed unused components (`PlayerCard`, `RoundRow`)
✅ Removed unused store (`useAppStore.ts`)
✅ Removed unused library (`points.ts` - replaced by `scoring.ts`)
✅ Consolidated data files in `public/` directory

## 📝 Import Patterns

All imports use absolute paths with `@/` alias:

```typescript
// Cards
import { ConnectionCard } from "@/components/cards/ConnectionCard";
import { MatchupCard } from "@/components/cards/MatchupCard";

// Modals
import { ConnectionModal } from "@/components/modals/ConnectionModal";

// Windows
import { StartersWindow } from "@/components/windows/StartersWindow";

// Layout
import { Navigation } from "@/components/layout/Navigation";

// Utilities
import { generateMatchups } from "@/lib/matchups";
import { matchupWinner } from "@/lib/scoring";
```

