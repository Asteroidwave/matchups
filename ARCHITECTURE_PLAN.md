# Architecture & Implementation Plan
## Converting Prototype to Production-Ready Platform

---

## 📋 **Current State Analysis**

### What We Have:
- ✅ Frontend prototype (Next.js/React) with static JSON data
- ✅ Python scripts that connect to MongoDB and calculate:
  - Salaries (based on odds, also-eligible handling)
  - Points (top 3 finishes)
  - Matchup generation
  - Odds conversion (fractional → decimal)
- ✅ MongoDB databases:
  - `common-central` (equibase_entries, equibase_results)
  - `staging-gos` (horses, jockeyperformances, trainerperformances, sireperformances)

### What We Need:
- 🔄 **Backend API** to replace static JSON files
- 🔐 **Authentication system** (user login/signup)
- 👥 **User management** (player profiles, balances)
- 🔧 **Admin panel** (view players, manage balances, view contests)
- 📅 **Contest management** (future contests, past results)
- 🔄 **Real-time data** (live race status, results)
- 📊 **Data synchronization** (scheduled jobs to fetch from MongoDB)

---

## 🏗️ **Proposed Architecture**

### **Option A: Next.js API Routes (Recommended for MVP)**
```
Frontend (Next.js/React)
    ↓
API Routes (/api/*)
    ↓
MongoDB (via Mongoose/Node.js)
```

**Pros:**
- Single codebase
- Easy deployment (Vercel)
- Built-in API routes
- TypeScript end-to-end

**Cons:**
- Limited background job support (need Vercel Cron or external service)

### **Option B: Separate Backend (Better for Scale)**
```
Frontend (Next.js) ←→ Backend API (Node.js/Express or Python/FastAPI)
                            ↓
                    MongoDB + Redis (caching)
                    Background Jobs (BullMQ/Celery)
```

**Pros:**
- Better separation of concerns
- More flexible for complex background jobs
- Can reuse Python scripts as microservices

**Cons:**
- More complex deployment
- CORS configuration needed
- Two codebases to maintain

**Recommendation: Start with Option A, migrate to Option B when needed.**

---

## 📦 **Step-by-Step Implementation Plan**

### **Phase 1: Backend Foundation (Week 1-2)**

#### **1.1 Setup MongoDB Connection**
- [ ] Install MongoDB driver (`mongodb` or `mongoose`)
- [ ] Create connection utility with environment variables
- [ ] Test connection to both databases
- [ ] Create TypeScript types matching MongoDB schemas

**Files to create:**
```
lib/mongodb.ts          # MongoDB connection
lib/mongodb/types.ts     # TypeScript types
.env.local              # Environment variables
```

#### **1.2 Create API Routes**
- [ ] `/api/contests` - List upcoming/past contests
- [ ] `/api/contests/[id]` - Get contest details
- [ ] `/api/tracks/[track]/entries` - Get entries for a track/date
- [ ] `/api/tracks/[track]/results` - Get results for a track/date
- [ ] `/api/connections/[track]/[date]` - Get processed connections (jockeys/trainers/sires)
- [ ] `/api/matchups` - Generate matchups for a contest

**Example API structure:**
```
/api
  /contests
    GET /              # List contests
    POST /             # Create contest (admin)
    GET /[id]          # Get contest details
    GET /[id]/results  # Get contest results
  /tracks
    GET /[track]/entries?date=YYYY-MM-DD
    GET /[track]/results?date=YYYY-MM-DD
  /connections
    GET /[track]/[date]?role=jockey|trainer|sire
  /matchups
    POST /             # Generate matchups
    GET /[contestId]   # Get matchups for contest
```

#### **1.3 Port Python Calculations to TypeScript**
- [ ] `fractional_to_decimal()` - Odds conversion
- [ ] `calculate_salary_based_on_odds()` - Salary calculation
- [ ] `is_also_eligible_flag()` - Also eligible detection
- [ ] `calculate_points()` - Points calculation (top 3 finishes)
- [ ] `calculate_avpa()` - AVPA calculations
- [ ] `generate_matchups()` - Matchup generation logic

**Files to create:**
```
lib/calculations/
  odds.ts              # Odds conversion
  salary.ts            # Salary calculations
  points.ts            # Points calculations
  avpa.ts              # AVPA calculations
  matchups.ts          # Matchup generation (already exists, enhance)
```

---

### **Phase 2: Authentication & User Management (Week 2-3)**

#### **2.1 Setup Authentication**
- [ ] Install NextAuth.js or Clerk
- [ ] Configure authentication provider (email/password, Google OAuth, etc.)
- [ ] Create user schema in MongoDB
- [ ] Create login/signup pages

**Recommended: NextAuth.js (fits Next.js perfectly)**

**User Schema:**
```typescript
interface User {
  _id: string;
  email: string;
  name: string;
  role: 'player' | 'admin';
  balance: number;        // Starting balance
  createdAt: Date;
  updatedAt: Date;
}
```

#### **2.2 User API Routes**
- [ ] `/api/auth/[...nextauth]` - NextAuth handler
- [ ] `/api/users/me` - Get current user
- [ ] `/api/users/[id]` - Get user profile
- [ ] `/api/users/[id]/balance` - Update balance (admin only)

#### **2.3 Protected Routes**
- [ ] Create middleware for protected routes
- [ ] Add authentication checks to API routes
- [ ] Create login/signup UI pages

---

### **Phase 3: Contest System (Week 3-4)**

#### **3.1 Contest Schema**
```typescript
interface Contest {
  _id: string;
  name: string;
  date: string;          // YYYY-MM-DD
  tracks: string[];      // ['GP', 'BAQ', 'KEE']
  status: 'upcoming' | 'live' | 'completed';
  entryFee: number;
  prizePool: number;
  maxEntries?: number;
  createdAt: Date;
  startTime?: Date;
  endTime?: Date;
}
```

#### **3.2 Contest Management**
- [ ] Create contest creation UI (admin)
- [ ] Contest listing page (players)
- [ ] Contest detail page
- [ ] Contest results page

#### **3.3 Entry System**
```typescript
interface Entry {
  _id: string;
  contestId: string;
  userId: string;
  matchups: Matchup[];
  picks: RoundPick[];
  totalPoints: number;
  totalSalary: number;
  rank?: number;
  winnings?: number;
  createdAt: Date;
}
```

- [ ] Create entry API routes
- [ ] Entry submission UI
- [ ] Entry validation (balance check, deadline check)

---

### **Phase 4: Admin Panel (Week 4-5)**

#### **4.1 Admin Dashboard**
- [ ] Admin-only route protection
- [ ] Dashboard page with:
  - Active contests
  - Recent entries
  - User statistics
  - Revenue overview

#### **4.2 User Management**
- [ ] User list page (with search/filter)
- [ ] User detail page
- [ ] Balance adjustment UI
- [ ] User activity log

#### **4.3 Contest Management**
- [ ] Create/edit contests
- [ ] View contest entries
- [ ] Manually trigger scoring
- [ ] Payout management

---

### **Phase 5: Real-Time Data & Background Jobs (Week 5-6)**

#### **5.1 Data Synchronization**
- [ ] Create scheduled job to fetch new entries/results
- [ ] Process and store data in MongoDB
- [ ] Update contest statuses (upcoming → live → completed)

**Options:**
- **Vercel Cron** (if using Next.js API routes)
- **Upstash QStash** (serverless queue)
- **Separate worker service** (if using separate backend)

#### **5.2 Real-Time Updates**
- [ ] WebSocket or Server-Sent Events for live race updates
- [ ] Real-time contest leaderboard
- [ ] Live race status indicators

#### **5.3 Caching Strategy**
- [ ] Redis or Upstash Redis for caching
- [ ] Cache contest data, connections, matchups
- [ ] Invalidate cache on updates

---

## 🛠️ **Technology Stack Recommendations**

### **Core Stack:**
- **Frontend:** Next.js 14+ (App Router), React, TypeScript, Tailwind CSS
- **Backend:** Next.js API Routes (or Express/FastAPI if separate)
- **Database:** MongoDB (already have access)
- **Authentication:** NextAuth.js or Clerk
- **Caching:** Upstash Redis (serverless) or Redis
- **Background Jobs:** Vercel Cron + Upstash QStash or BullMQ

### **Additional Tools:**
- **Environment Variables:** `.env.local` for secrets
- **API Documentation:** Swagger/OpenAPI (if separate backend)
- **Monitoring:** Sentry (error tracking)
- **Analytics:** PostHog or Vercel Analytics

---

## 📁 **Proposed File Structure**

```
project/
├── app/
│   ├── api/                    # API routes
│   │   ├── auth/
│   │   ├── contests/
│   │   ├── tracks/
│   │   ├── connections/
│   │   ├── matchups/
│   │   └── users/
│   ├── admin/                  # Admin pages (protected)
│   ├── login/                  # Auth pages
│   ├── matchups/               # Existing
│   └── results/                # Existing
├── lib/
│   ├── mongodb/                # MongoDB connection & types
│   ├── calculations/           # Ported from Python
│   │   ├── odds.ts
│   │   ├── salary.ts
│   │   ├── points.ts
│   │   └── avpa.ts
│   ├── auth/                   # Auth utilities
│   └── utils/                  # Existing utilities
├── models/                     # MongoDB schemas (if using Mongoose)
│   ├── User.ts
│   ├── Contest.ts
│   └── Entry.ts
├── components/
│   ├── admin/                  # Admin components
│   └── ...                     # Existing components
└── other codes/                # Existing Python scripts
```

---

## 🔐 **Security Considerations**

1. **Environment Variables:** Store MongoDB credentials in `.env.local`
2. **API Authentication:** Protect all API routes with middleware
3. **Role-Based Access:** Admin vs Player roles
4. **Input Validation:** Validate all user inputs
5. **Rate Limiting:** Prevent abuse (use Upstash Ratelimit)
6. **HTTPS:** Always use HTTPS in production

---

## 🚀 **Deployment Strategy**

### **Development:**
- Local MongoDB connection
- Next.js dev server
- Environment variables in `.env.local`

### **Production:**
- **Frontend:** Vercel (recommended for Next.js)
- **Database:** MongoDB Atlas (already have)
- **Backend Jobs:** Vercel Cron or separate worker
- **Caching:** Upstash Redis

### **Environment Variables Needed:**
```env
# MongoDB
MONGODB_URI_COMMON=mongodb+srv://...
MONGODB_URI_STAGING=mongodb+srv://...

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key

# Admin
ADMIN_EMAIL=your-admin@email.com

# Optional: Redis
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

---

## 📊 **Database Schema Design**

### **Users Collection:**
```typescript
{
  _id: ObjectId,
  email: string (unique, indexed),
  name: string,
  passwordHash: string,
  role: 'player' | 'admin',
  balance: number,
  createdAt: Date,
  updatedAt: Date
}
```

### **Contests Collection:**
```typescript
{
  _id: ObjectId,
  name: string,
  date: string,
  tracks: string[],
  status: 'upcoming' | 'live' | 'completed',
  entryFee: number,
  prizePool: number,
  maxEntries?: number,
  createdAt: Date,
  startTime?: Date,
  endTime?: Date
}
```

### **Entries Collection:**
```typescript
{
  _id: ObjectId,
  contestId: ObjectId (indexed),
  userId: ObjectId (indexed),
  matchups: Matchup[],
  picks: RoundPick[],
  totalPoints: number,
  totalSalary: number,
  rank?: number,
  winnings?: number,
  createdAt: Date
}
```

### **Keep Existing Collections:**
- `equibase_entries` (from common-central)
- `equibase_results` (from common-central)
- `horses`, `jockeyperformances`, etc. (from staging-gos)

---

## 🎯 **Next Steps (Immediate Actions)**

1. **Create MongoDB connection utility** (`lib/mongodb.ts`)
2. **Port key calculation functions** from Python to TypeScript
3. **Create first API route** (`/api/tracks/[track]/entries`)
4. **Update frontend** to use API instead of static JSON
5. **Setup NextAuth.js** for authentication
6. **Create admin route structure**

---

## 📝 **Questions to Decide**

1. **Authentication Provider:** NextAuth.js vs Clerk?
2. **Backend Architecture:** API Routes vs Separate Backend?
3. **Real-Time:** WebSockets vs Server-Sent Events vs Polling?
4. **Background Jobs:** Vercel Cron vs Separate Worker Service?
5. **Payment Processing:** Stripe integration for deposits/withdrawals?

---

## 📚 **Resources Needed**

1. **MongoDB Atlas Account** (already have)
2. **Vercel Account** (for deployment)
3. **Upstash Account** (for Redis & QStash, free tier available)
4. **Environment Variables** (MongoDB credentials)
5. **Domain Name** (optional for production)

---

## ✅ **Success Criteria**

- [ ] Backend API successfully fetches from MongoDB
- [ ] Frontend uses API instead of static JSON
- [ ] Users can sign up and log in
- [ ] Admins can view/manage users
- [ ] Contests can be created and entries submitted
- [ ] Results are calculated and displayed
- [ ] Real-time updates work for live races
- [ ] Background jobs sync data automatically

---

**Ready to start? Let me know which phase you'd like to begin with, and I'll help you implement it step by step!**

