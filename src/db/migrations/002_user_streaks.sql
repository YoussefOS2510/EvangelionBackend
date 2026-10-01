-- Migration 002: Add extended streak tracking columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS longest_streak INT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_completed_date DATE;

-- Initialize longest_streak with existing current_streak where applicable
UPDATE users SET longest_streak = current_streak WHERE longest_streak < current_streak;
