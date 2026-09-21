# Bilingual Daily Bible Reading Platform (Backend System Design)

## 1. System Overview & Objectives

This document specifies the backend architecture for a church daily Bible reading system tailored for children across specified grade brackets.

### Scripture Translations Standardized

* **Arabic:** Smith & Van Dyck Version (AVD / الترجمة العربية المشتركة/فانديك - التوراة والإنجيل، سميث وفاندايك).
* **English:** New King James Version (NKJV).

### Core Target Groups

1. Grade 3 & 4 Boys
2. Grade 3 & 4 Girls
3. Grade 5 & 6 Boys
4. Grade 5 & 6 Girls
5. Grade 6, 7 & 8 Boys
6. Grade 6, 7 & 8 Girls
7. Grade 10, 11 & 12 Mixed

### System Roles

* **Kid / Student:** Reads assigned daily verses in Arabic (Van Dyck) or English (NKJV), answers assigned comprehension questions (MCQ or short-answer), gains points, and tracks position on an age-segregated leaderboard.
* **Progress Viewer Servant:** Read-only access to roster daily completion, scores, and streak data across assigned cohorts.
* **Admin Servant:** Full access to schedule daily passages using start/end verse boundaries and selective exclusions, create manual questions, trigger and approve AI-generated questions, and manage user rosters.

## 2. Authentication & Identity Architecture (Deferred for Design Review)

> [!NOTE]
> Authentication mechanisms (Kid PINs, QR badges, and Servant credential management) are temporarily **on hold** pending UX and security threat model refinement (e.g., mitigating classmate-targeted denial-of-service lockouts and defining badge revocation).
> 
> **Development & Prototype Phase:**
> * Endpoints simulate user identity and role via HTTP headers:
>   * `X-User-Id: <uuid>`
>   * `X-User-Role: kid | viewer_servant | admin_servant`
>   * `X-Group-Id: <int>`
> * Final authentication (WebAuthn, Magic Badges, Parent Gate, or Session PINs) will be integrated in a subsequent iteration without altering core domain APIs.

## 3. High-Level System Architecture

```
                    ┌────────────────────────────────────────┐
                    │               Client App               │
                    └───────────────────┬────────────────────┘
                                        │ HTTPS / WSS
                                        ▼
                    ┌────────────────────────────────────────┐
                    │         API Gateway / NGINX            │
                    │   - Rate Limiting (Token Bucket)       │
                    │   - SSL Termination                    │
                    └───────────────────┬────────────────────┘
                                        │
                                        ▼
                    ┌────────────────────────────────────────┐
                    │        Application Core (REST)         │
                    │  ├── Auth Module                       │
                    │  ├── Verse Picker & Assembly           │
                    │  ├── AI Generation Engine (AVD + NKJV) │
                    │  ├── Evaluation & Leaderboard Engine   │
                    │  └── Servant Reporting Engine          │
                    └───┬─────────────┬──────────────────┬───┘
                        │             │                  │
         ┌──────────────┘             │                  └──────────────┐
         ▼                            ▼                                 ▼
┌─────────────────┐          ┌───────────────────┐            ┌───────────────────┐
│ PostgreSQL 16   │          │ Redis 7           │            │ LLM Provider API  │
│ - Van Dyck (AR) │          │ - Leaderboards    │            │ (Structured JSON  │
│ - NKJV (EN)     │          │   (Sorted Sets)   │            │  Generation)      │
│ - Users & Roster│          │ - Rate Limits     │            └───────────────────┘
│ - Readings/Qs   │          │ - Passage Caching │
└─────────────────┘          └───────────────────┘
```

## 4. Database Schema (PostgreSQL DDL)

```sql
-- Enums
CREATE TYPE user_role AS ENUM ('kid', 'viewer_servant', 'admin_servant');
CREATE TYPE question_type AS ENUM ('mcq', 'true_false', 'short_answer');
CREATE TYPE gender_category AS ENUM ('boys', 'girls', 'mixed');
CREATE TYPE preferred_language AS ENUM ('ar', 'en');

-- 1. Cohort Groups
CREATE TABLE groups (
    id SERIAL PRIMARY KEY,
    name VARCHAR(64) NOT NULL,
    gender gender_category NOT NULL,
    min_grade INT NOT NULL,
    max_grade INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Users Table (Identity deferred; role and basic profile active)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id INT REFERENCES groups(id) ON DELETE SET NULL,
    full_name VARCHAR(128) NOT NULL,
    username VARCHAR(64) UNIQUE, -- Servants
    password_hash VARCHAR(255),  -- Servants (Argon2id, deferred)
    pin_hash VARCHAR(255),       -- Kids (4-digit PIN, deferred)
    role user_role NOT NULL DEFAULT 'kid',
    preferred_lang preferred_language NOT NULL DEFAULT 'ar',
    total_points INT NOT NULL DEFAULT 0,
    current_streak INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_users_group_points ON users(group_id, total_points DESC);

-- 3. Canonical Bible Verses Repository (Arabic Van Dyck & English NKJV)
CREATE TABLE bible_verses (
    id SERIAL PRIMARY KEY,
    book_number INT NOT NULL,         -- 1 (Genesis / التكوين) to 66 (Revelation / الرؤيا)
    book_name_en VARCHAR(64) NOT NULL,
    book_name_ar VARCHAR(64) NOT NULL,
    chapter INT NOT NULL,
    verse INT NOT NULL,
    text_en_nkjv TEXT NOT NULL,       -- New King James Version (NKJV)
    text_ar_vandyk TEXT NOT NULL,     -- Smith & Van Dyck Version (AVD, with Tashkeel)
    text_ar_clean TEXT NOT NULL,      -- Smith & Van Dyck (Tashkeel/Diacritics removed for normalized search)
    CONSTRAINT uq_bible_verse UNIQUE (book_number, chapter, verse)
);
CREATE INDEX idx_bible_lookup ON bible_verses(book_number, chapter, verse);
CREATE INDEX idx_bible_clean_ar ON bible_verses(book_number, chapter, verse) INCLUDE (text_ar_clean);

-- 4. Daily Scheduled Readings (Supports Cross-Chapter Spans)
CREATE TABLE daily_readings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id INT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    scheduled_date DATE NOT NULL,
    book_number INT NOT NULL,
    start_chapter INT NOT NULL,
    start_verse INT NOT NULL,
    end_chapter INT NOT NULL,
    end_verse INT NOT NULL,
    excluded_verses JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of objects: [{"chapter": 1, "verse": 4}]
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_group_date UNIQUE (group_id, scheduled_date),
    CONSTRAINT ck_reading_range CHECK (
        start_chapter < end_chapter OR 
        (start_chapter = end_chapter AND start_verse <= end_verse)
    )
);
CREATE INDEX idx_daily_readings_schedule ON daily_readings(group_id, scheduled_date);

-- 5. Daily Reading Questions (Multi-Question Support per Reading)
CREATE TABLE questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reading_id UUID NOT NULL REFERENCES daily_readings(id) ON DELETE CASCADE,
    type question_type NOT NULL DEFAULT 'mcq',
    prompt_ar TEXT NOT NULL,
    prompt_en TEXT NOT NULL,
    options JSONB,                    -- For MCQ: {"A": {"en": "..", "ar": ".."}, ...}
    correct_answer TEXT NOT NULL,     -- MCQ: "A", "B", "C", "D"
    points_value INT NOT NULL DEFAULT 10,
    is_ai_generated BOOLEAN NOT NULL DEFAULT FALSE,
    is_approved BOOLEAN NOT NULL DEFAULT TRUE,
    approved_by UUID REFERENCES users(id),
    sort_order INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_questions_reading ON questions(reading_id, sort_order);

-- 6. Student Submissions & Progress
CREATE TABLE submissions (
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
CREATE INDEX idx_submissions_user ON submissions(user_id, submitted_at);
CREATE INDEX idx_submissions_reading ON submissions(reading_id);
```

## 5. Verse Assembly & Query Engine

When an admin schedules a passage (e.g., John 1:35 through 2:11, or John 3:1–21 excluding verses 11 and 12), the verse extraction engine queries `bible_verses` across arbitrary chapter spans with JSONB exclusions:

### Cross-Chapter Extraction Query

```sql
SELECT 
    book_number,
    chapter,
    verse, 
    text_ar_vandyk AS text_ar, 
    text_ar_clean,
    text_en_nkjv AS text_en 
FROM bible_verses 
WHERE book_number = $1 
  AND (
    -- Single chapter span
    ($2 = $4 AND chapter = $2 AND verse BETWEEN $3 AND $5)
    OR
    -- Multi-chapter start boundary
    ($2 < $4 AND chapter = $2 AND verse >= $3)
    OR
    -- Multi-chapter intermediate full chapters
    ($2 < $4 AND chapter > $2 AND chapter < $4)
    OR
    -- Multi-chapter end boundary
    ($2 < $4 AND chapter = $4 AND verse <= $5)
  )
  -- Exclude specific chapter/verse pairs
  AND NOT EXISTS (
    SELECT 1 
    FROM jsonb_to_recordset($6::jsonb) AS ex(chapter INT, verse INT)
    WHERE ex.chapter = bible_verses.chapter 
      AND ex.verse = bible_verses.verse
  )
ORDER BY chapter ASC, verse ASC;
```

Passages for upcoming days are compiled and cached in Redis with a 24-hour TTL:
`Key: cache:readings:{group_id}:{YYYY-MM-DD}`.

## 6. AI Question Generation Workflow

To streamline daily lesson creation for Admin Servants, an AI generation pipeline takes the extracted passage in both **Arabic (Van Dyck)** and **English (NKJV)** and produces age-appropriate questions aligned with developmental stages.

```
┌──────────────┐     Select Passage & Click    ┌──────────────────────┐
│ Admin Client │──────────────────────────────▶│ API: /ai-generate    │
│ (Servant UI) │                               └──────────┬───────────┘
└──────────────┘                                          │
                                       Fetch Verses (Van Dyck & NKJV)
                                                          │
                                                          ▼
┌─────────────────────────┐   Strict Grounded Prompt   ┌──────────────────────┐
│   LLM API (Gemini/GPT)  │◀───────────────────────────│ AI Orchestration Svc │
└────────────┬────────────┘   (Context + Negative Cnstr)└──────────────────────┘
             │
             │ Validated JSON Output
             ▼
┌─────────────────────────┐
│ Draft Question Returned │ (Server verifies correct_answer ∈ options)
└────────────┬────────────┘
             │
             │ Admin Reviews / Modifies / Approves
             ▼
┌─────────────────────────┐
│ Saved to DB & Scheduled │
└─────────────────────────┘
```

### Prompt Specification & Strict JSON Schema

```json
{
  "system_instruction": "You are an Orthodox Sunday school curriculum specialist. Generate an age-appropriate comprehension question for children in grades {min_grade} to {max_grade}. Base the question STRICTLY on the provided scripture passage. Do NOT invent facts or cite external theological commentary outside the text. Output must be bilingual (Arabic: Van Dyck terminology, English: NKJV terminology) and formatted strictly according to the schema.",
  "prompt_template": "<context>\n[ARABIC - SMITH & VAN DYCK]:\n{verses_ar}\n\n[ENGLISH - NEW KING JAMES VERSION]:\n{verses_en}\n</context>\nGenerate 1 Multiple Choice Question (MCQ) testing reading comprehension for grades {min_grade}-{max_grade}.",
  "parameters": {
    "type": "object",
    "properties": {
      "type": { "type": "string", "enum": ["mcq", "true_false"] },
      "prompt_ar": { "type": "string" },
      "prompt_en": { "type": "string" },
      "options": {
        "type": "object",
        "description": "4 options for MCQ (A, B, C, D) or 2 for true_false (A, B)",
        "properties": {
          "A": { "type": "object", "properties": { "ar": { "type": "string" }, "en": { "type": "string" } }, "required": ["ar", "en"] },
          "B": { "type": "object", "properties": { "ar": { "type": "string" }, "en": { "type": "string" } }, "required": ["ar", "en"] },
          "C": { "type": "object", "properties": { "ar": { "type": "string" }, "en": { "type": "string" } }, "required": ["ar", "en"] },
          "D": { "type": "object", "properties": { "ar": { "type": "string" }, "en": { "type": "string" } }, "required": ["ar", "en"] }
        },
        "required": ["A", "B"]
      },
      "correct_answer": { "type": "string", "enum": ["A", "B", "C", "D"] }
    },
    "required": ["type", "prompt_ar", "prompt_en", "options", "correct_answer"]
  }
}
```

* **Validation Guardrail:** Before returning to the Admin UI, the backend validates that `correct_answer` is an existing key in `options`.

## 7. Multi-Window Leaderboard Architecture

Each kid competes solely within their assigned cohort (`group_id`). To keep kids engaged regardless of when they join during the year, rankings are maintained across three distinct time windows using **Redis Sorted Sets (ZSET)**.

### Redis Keys
* **All-Time:** `leaderboard:group:{group_id}:all_time`
* **Monthly:** `leaderboard:group:{group_id}:monthly:{YYYY-MM}`
* **Weekly:** `leaderboard:group:{group_id}:weekly:{YYYY-WW}`

### Redis Atomic Operations on Correct Answer Submission
```redis
-- Pipeline atomic increments across all 3 windows:
ZINCRBY leaderboard:group:{group_id}:all_time {points} {user_id}
ZINCRBY leaderboard:group:{group_id}:monthly:{YYYY-MM} {points} {user_id}
ZINCRBY leaderboard:group:{group_id}:weekly:{YYYY-WW} {points} {user_id}
```

### Fetching Leaderboard & Kid Position
```redis
-- Fetch Top 50 for selected window (e.g. weekly):
ZREVRANGE leaderboard:group:{group_id}:weekly:{YYYY-WW} 0 49 WITHSCORES

-- Fetch kid's standing & rank:
ZREVRANK leaderboard:group:{group_id}:weekly:{YYYY-WW} {user_id}
ZSCORE leaderboard:group:{group_id}:weekly:{YYYY-WW} {user_id}
```

### Fault-Tolerance & Cache Warming
If Redis memory restarts, a cold-start sync job warms the active weekly and monthly leaderboards from PostgreSQL:
```sql
SELECT user_id, SUM(points_awarded) AS total_points
FROM submissions s
JOIN users u ON u.id = s.user_id
WHERE u.group_id = $1 
  AND s.submitted_at >= $2 -- Window start timestamp
GROUP BY user_id;
```

## 8. RESTful API Specification

> [!NOTE]
> Authentication endpoints (`/api/v1/auth/*`) are deferred. All endpoints currently accept identity headers (`X-User-Id`, `X-User-Role`, `X-Group-Id`) for development and automated tests.

### Kid Endpoints

* `GET /api/v1/readings/today`
  * Headers: `X-User-Id: <uuid>`, `X-Group-Id: <int>`
  * Response:
    ```json
    {
      "reading_id": "a9c1e7a4-...",
      "translation": {
        "ar": "Van Dyck (فانديك)",
        "en": "NKJV (New King James Version)"
      },
      "reference": { "ar": "يوحنا ١: ٣٥ - ٢: ١١", "en": "John 1:35 - 2:11" },
      "verses": [
        {
          "chapter": 1,
          "verse": 35,
          "text_ar": "وَفِي الْغَدِ أَيْضاً كَانَ يُوحَنَّا وَاقِفاً هُوَ وَاثْنَانِ مِنْ تَلَامِيذِهِ...",
          "text_en": "Again, the next day, John stood with two of his disciples..."
        }
      ],
      "questions": [
        {
          "id": "b3e2a1...",
          "sort_order": 1,
          "type": "mcq",
          "prompt_ar": "كَمْ تِلْمِيذًا كَانَا وَاقِفَيْنِ مَعَ يُوحَنَّا؟",
          "prompt_en": "How many disciples were standing with John?",
          "options": {
            "A": { "ar": "اثْنَانِ", "en": "Two" },
            "B": { "ar": "ثَلَاثَة", "en": "Three" },
            "C": { "ar": "أَرْبَعَة", "en": "Four" },
            "D": { "ar": "وَاحِد", "en": "One" }
          },
          "points_value": 10,
          "already_answered": false,
          "user_answer": null,
          "is_correct": null
        }
      ],
      "is_fully_completed": false,
      "total_points_earned_today": 0
    }
    ```

* `POST /api/v1/readings/{id}/submit`
  * Headers: `X-User-Id: <uuid>`
  * Body: `{"question_id": "b3e2a1...", "answer": "A"}`
  * Response: 
    ```json
    {
      "question_id": "b3e2a1...",
      "is_correct": true,
      "points_earned": 10,
      "current_streak": 5,
      "reading_completed": true
    }
    ```

* `GET /api/v1/leaderboard`
  * Query parameters: `?window=weekly|monthly|all_time` (default: `weekly`)
  * Headers: `X-User-Id: <uuid>`, `X-Group-Id: <int>`
  * Returns: Cohort ranking list with scores and current user's highlighted rank.

### Servant & Admin Endpoints

* `POST /api/v1/admin/readings/schedule` (Multi-Cohort Transaction)
  * Body:
    ```json
    {
      "group_ids": [1, 2],
      "scheduled_date": "2026-10-15",
      "book_number": 43,
      "start_chapter": 1,
      "start_verse": 35,
      "end_chapter": 2,
      "end_verse": 11,
      "excluded_verses": [{"chapter": 1, "verse": 40}]
    }
    ```

* `POST /api/v1/admin/questions/ai-generate`
  * Body: `{"reading_id": "uuid", "type": "mcq"}`
  * Returns draft question generated against the bilingual text.

* `POST /api/v1/admin/questions/commit`
  * Body: `{"reading_id": "uuid", "questions": [...]}`
  * Saves or updates validated question payload in `questions` table.

* `GET /api/v1/servant/reports/daily`
  * Query parameters: `group_id=1&date=2026-10-15`
  * Returns completion status per student, streaks, and individual answers.

## 9. Reliability, Scalability & Streak Integrity Constraints

1. **Timezone & Midnight Cutoff:**
   * Church operations are aligned to local church timezone (e.g., `Africa/Cairo`).
   * Daily readings unlock at `00:00:00` church local time.

2. **Scheduled-Day Streak Logic (No Penalty for Off-Days):**
   * Streaks increment based on **consecutive scheduled reading days completed**, rather than raw calendar days.
   * If no reading is scheduled for a cohort on a given day (e.g. holidays, Sundays, feast days), streaks are preserved and not broken.

3. **Missing Reading Safeguards:**
   * A scheduled cron check runs daily at 18:00 (for the *next* day). If any of the 7 cohorts lacks a scheduled reading and at least one approved question for tomorrow, an incident notification webhook alerts the Admin Servants.

4. **Idempotency & Integrity:**
   * Database level `UNIQUE(user_id, question_id)` guarantees points cannot be double-counted if a student taps "Submit" repeatedly.