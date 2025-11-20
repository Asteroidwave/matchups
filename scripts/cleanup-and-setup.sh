#!/bin/bash

# COMPLETE SUPABASE CLEANUP AND ADMIN SETUP
# This script cleans up Supabase and creates ritho@ralls as admin

echo "🧹 Starting Supabase cleanup and admin setup..."
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if backend is running
echo -e "${BLUE}🔍 Checking backend status...${NC}"
if curl -s http://localhost:3001/api/health > /dev/null; then
    echo -e "${GREEN}✅ Backend is running${NC}"
else
    echo -e "${RED}❌ Backend is not running. Please start it first:${NC}"
    echo "   cd backend && npm run dev"
    exit 1
fi

echo ""
echo -e "${YELLOW}⚠️  WARNING: This will DELETE ALL DATA in your Supabase database!${NC}"
echo -e "${YELLOW}   - All tables will be cleared${NC}"
echo -e "${YELLOW}   - All user data will be removed${NC}"
echo -e "${YELLOW}   - Only ritho@ralls will remain as admin${NC}"
echo ""
read -p "Are you sure you want to continue? (yes/no): " -r
if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo "Operation cancelled."
    exit 1
fi

echo ""
echo -e "${BLUE}📋 Step 1: Manual Supabase SQL Cleanup${NC}"
echo "=================================================="
echo "Please run the following in your Supabase SQL Editor:"
echo ""
echo -e "${YELLOW}1. Go to: https://supabase.com/dashboard/project/[your-project]/sql${NC}"
echo -e "${YELLOW}2. Copy and paste the contents of: scripts/cleanup-supabase.sql${NC}"
echo -e "${YELLOW}3. Click 'Run' to execute the cleanup${NC}"
echo ""
echo "Contents of cleanup-supabase.sql:"
echo "-----------------------------------"
cat scripts/cleanup-supabase.sql
echo ""
echo -e "${YELLOW}After running the SQL cleanup, press Enter to continue...${NC}"
read -r

echo ""
echo -e "${BLUE}📋 Step 2: Creating Admin User via API${NC}"
echo "=================================================="

# Run the admin user creation script
node scripts/create-admin-user.js

echo ""
echo -e "${GREEN}🎉 Cleanup and setup completed!${NC}"
echo "=================================================="
echo ""
echo -e "${GREEN}✅ What was done:${NC}"
echo "   • All old Supabase data cleared"
echo "   • Database schema preserved"
echo "   • ritho@ralls created as admin user"
echo ""
echo -e "${BLUE}🎯 Next Steps:${NC}"
echo "   1. Go to your app: http://localhost:3000"
echo "   2. Sign in with:"
echo "      Email: ritho@ralls"
echo "      Password: admin123"
echo "   3. Look for 'Admin' in the navigation"
echo "   4. Click Admin to access the admin panel"
echo ""
echo -e "${YELLOW}💡 Admin Panel Features:${NC}"
echo "   • Contest Management - Create/manage contests"
echo "   • Track Management - Manage racing tracks"
echo "   • User Management - Manage user accounts"
echo "   • Simulation Panel - Testing and debugging tools"
echo ""
echo -e "${GREEN}✨ Your platform is now clean and ready!${NC}"
