# 🏇 Horse Racing Matchups Platform

A modern, multi-user fantasy horse racing platform built with Next.js, Supabase, and real-time simulation capabilities.

## 🎯 Features

- **Multi-User System**: Each user has their own account, bankroll, and game history
- **Real-time Simulations**: Live race simulations with WebSocket updates
- **Cross-Track Matchups**: Create matchups across multiple racetracks
- **Admin Panel**: Comprehensive contest and user management
- **Relational Database**: Full PostgreSQL backend with Row Level Security
- **Live Race Tracking**: Ready for real-time race result integration

## 🚀 Quick Start

1. **Clone & Install**:
   ```bash
   git clone <repository>
   cd project
   npm install
   cd backend && npm install
   ```

2. **Environment Setup**:
   ```bash
   # Copy environment templates
   cp .env.example .env.local
   cp backend/.env.example backend/.env
   # Fill in your Supabase, Redis, and MongoDB credentials
   ```

3. **Database Setup**:
   ```bash
   # Run in Supabase SQL Editor:
   # 1. docs/architecture/NEW_RELATIONAL_SCHEMA.sql
   # 2. docs/setup/ENABLE_RLS_POLICIES_SIMPLE.sql
   ```

4. **Start Development**:
   ```bash
   # Terminal 1: Frontend
   npm run dev
   
   # Terminal 2: Backend  
   cd backend && npm run dev
   ```

## 📁 Project Structure

```
├── app/                    # Next.js app directory
├── backend/                # Express.js backend
├── components/             # React components
├── contexts/               # React contexts
├── docs/                   # Documentation
│   ├── architecture/       # Database & system architecture
│   ├── features/           # Feature specifications
│   ├── implementation/     # Implementation guides
│   ├── setup/              # Setup & configuration
│   └── testing/            # Testing documentation
├── hooks/                  # Custom React hooks
├── lib/                    # Utility libraries
└── types/                  # TypeScript definitions
```

## 🎮 User Features

- **Create Account**: Sign up with email/password
- **Submit Matchups**: Pick jockey vs jockey, trainer vs trainer, etc.
- **Live Simulations**: Watch your picks play out in real-time
- **Track Results**: View your game history and statistics
- **Multi-Track**: Play across multiple racetracks simultaneously

## ⚙️ Admin Features

- **Contest Management**: Create contests for different tracks/dates
- **User Management**: View user accounts and statistics
- **Live Simulations**: Control race simulations in real-time
- **Track Management**: Enable/disable racetracks
- **Data Ingestion**: Import race data from MongoDB

## 🛠️ Tech Stack

- **Frontend**: Next.js 13, React 18, TypeScript, Tailwind CSS
- **Backend**: Node.js, Express, TypeScript
- **Database**: Supabase (PostgreSQL)
- **Real-time**: Socket.io WebSockets
- **Caching**: Redis (Upstash)
- **Data Source**: MongoDB Atlas
- **Deployment**: Vercel (Frontend), Railway (Backend)

## 📚 Documentation

See the [docs/](docs/) directory for comprehensive documentation:

- **[Architecture](docs/architecture/)**: Database schema and system design
- **[Setup](docs/setup/)**: Installation and configuration guides
- **[Features](docs/features/)**: Feature specifications and capabilities
- **[Implementation](docs/implementation/)**: Development guides
- **[Testing](docs/testing/)**: Testing procedures and reports

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is private and proprietary.