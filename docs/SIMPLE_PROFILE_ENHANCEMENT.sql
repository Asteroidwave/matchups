-- Simple Profile Enhancement (Run this first!)
-- Copy and paste this into Supabase SQL Editor

-- Add username column safely
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'username'
    ) THEN
        ALTER TABLE profiles ADD COLUMN username VARCHAR(50) UNIQUE;
        RAISE NOTICE 'Added username column';
    ELSE
        RAISE NOTICE 'Username column already exists';
    END IF;
END $$;

-- Add display name
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'display_name'
    ) THEN
        ALTER TABLE profiles ADD COLUMN display_name VARCHAR(100);
        RAISE NOTICE 'Added display_name column';
    ELSE
        RAISE NOTICE 'Display name column already exists';
    END IF;
END $$;

-- Add statistics columns
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'total_winnings'
    ) THEN
        ALTER TABLE profiles ADD COLUMN total_winnings DECIMAL(12,2) DEFAULT 0;
        ALTER TABLE profiles ADD COLUMN total_entries INTEGER DEFAULT 0;
        ALTER TABLE profiles ADD COLUMN win_percentage DECIMAL(5,2) DEFAULT 0;
        RAISE NOTICE 'Added statistics columns';
    ELSE
        RAISE NOTICE 'Statistics columns already exist';
    END IF;
END $$;

-- Add preference columns
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'favorite_tracks'
    ) THEN
        ALTER TABLE profiles ADD COLUMN favorite_tracks TEXT[];
        ALTER TABLE profiles ADD COLUMN subscription_tier VARCHAR(20) DEFAULT 'free';
        RAISE NOTICE 'Added preference columns';
    ELSE
        RAISE NOTICE 'Preference columns already exist';
    END IF;
END $$;

-- Verification
DO $$
DECLARE
    col_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO col_count
    FROM information_schema.columns
    WHERE table_name = 'profiles'
    AND column_name IN ('username', 'display_name', 'total_winnings', 'win_percentage', 'favorite_tracks');
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'PROFILE ENHANCEMENT COMPLETE!';
    RAISE NOTICE 'New profile columns added: %', col_count;
    RAISE NOTICE '✅ Ready for multi-user functionality';
    RAISE NOTICE '========================================';
END $$;
