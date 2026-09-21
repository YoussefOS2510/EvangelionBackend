-- Initial Schema Migration for Evangelion Bilingual Bible Reading Platform

-- 0. Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Enums
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('kid', 'viewer_servant', 'admin_servant');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'question_type') THEN
        CREATE TYPE question_type AS ENUM ('mcq', 'true_false', 'short_answer');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gender_category') THEN
        CREATE TYPE gender_category AS ENUM ('boys', 'girls', 'mixed');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'preferred_language') THEN
        CREATE TYPE preferred_language AS ENUM ('ar', 'en');
    END IF;
END $$;

-- 2. Cohort Groups
CREATE TABLE IF NOT EXISTS groups (
    id SERIAL PRIMARY KEY,
    name VARCHAR(64) NOT NULL,
    gender gender_category NOT NULL,
    min_grade INT NOT NULL,
    max_grade INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. Users Table (Identity/auth deferred; basic profiles active)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id INT REFERENCES groups(id) ON DELETE SET NULL,
    full_name VARCHAR(128) NOT NULL,
    username VARCHAR(64) UNIQUE,
    password_hash VARCHAR(255),
    pin_hash VARCHAR(255),
    role user_role NOT NULL DEFAULT 'kid',
    preferred_lang preferred_language NOT NULL DEFAULT 'ar',
    total_points INT NOT NULL DEFAULT 0,
    current_streak INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_users_group_points ON users(group_id, total_points DESC);

-- 4. Canonical Bible Verses Repository
CREATE TABLE IF NOT EXISTS bible_verses (
    id SERIAL PRIMARY KEY,
    book_number INT NOT NULL,
    book_name_en VARCHAR(64) NOT NULL,
    book_name_ar VARCHAR(64) NOT NULL,
    chapter INT NOT NULL,
    verse INT NOT NULL,
    text_en_nkjv TEXT NOT NULL,
    text_ar_vandyk TEXT NOT NULL,
    text_ar_clean TEXT NOT NULL,
    CONSTRAINT uq_bible_verse UNIQUE (book_number, chapter, verse)
);
CREATE INDEX IF NOT EXISTS idx_bible_lookup ON bible_verses(book_number, chapter, verse);
CREATE INDEX IF NOT EXISTS idx_bible_clean_ar ON bible_verses(book_number, chapter, verse);

-- 5. Daily Scheduled Readings
CREATE TABLE IF NOT EXISTS daily_readings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id INT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    scheduled_date DATE NOT NULL,
    book_number INT NOT NULL,
    start_chapter INT NOT NULL,
    start_verse INT NOT NULL,
    end_chapter INT NOT NULL,
    end_verse INT NOT NULL,
    excluded_verses JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_group_date UNIQUE (group_id, scheduled_date),
    CONSTRAINT ck_reading_range CHECK (
        start_chapter < end_chapter OR 
        (start_chapter = end_chapter AND start_verse <= end_verse)
    )
);
CREATE INDEX IF NOT EXISTS idx_daily_readings_schedule ON daily_readings(group_id, scheduled_date);

-- 6. Daily Reading Questions
CREATE TABLE IF NOT EXISTS questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reading_id UUID NOT NULL REFERENCES daily_readings(id) ON DELETE CASCADE,
    type question_type NOT NULL DEFAULT 'mcq',
    prompt_ar TEXT NOT NULL,
    prompt_en TEXT NOT NULL,
    options JSONB,
    correct_answer TEXT NOT NULL,
    points_value INT NOT NULL DEFAULT 10,
    is_ai_generated BOOLEAN NOT NULL DEFAULT FALSE,
    is_approved BOOLEAN NOT NULL DEFAULT TRUE,
    approved_by UUID REFERENCES users(id),
    sort_order INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_questions_reading ON questions(reading_id, sort_order);

-- 7. Submissions Table
CREATE TABLE IF NOT EXISTS submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reading_id UUID NOT NULL REFERENCES daily_readings(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    answer_text TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL,
    points_awarded INT NOT NULL DEFAULT 0,
    submitted_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_user_question UNIQUE (user_id, question_id)
);
CREATE INDEX IF NOT EXISTS idx_submissions_user ON submissions(user_id, submitted_at);
CREATE INDEX IF NOT EXISTS idx_submissions_reading ON submissions(reading_id);
