# Evangelion Backend 📖✝️
> High-performance, bilingual Coptic / Orthodox daily Scripture reading, AI comprehension, scheduled-day streak tracking, and multi-window leaderboard platform.

---

## 🌟 Overview

**Evangelion** is the backend service powering church Sunday School daily Scripture readings. It delivers synchronized, age-differentiated daily Bible readings and comprehension questions across **7 distinct student cohorts** (Grades 3 to 12) in both **Smith & Van Dyck Arabic** and **New King James Version (NKJV) English**.

### Core Capabilities
- **Bilingual Scripture Engine:** Preserves Arabic vocalization (tashkeel) with diacritic-stripped search indexes (`text_ar_clean`), cross-chapter verse ranges, and JSONB verse exclusion lists.
- **Scheduled-Day Streak Engine:** Rewards consecutive scheduled reading days completed **without penalizing church off-days** (holidays, Sundays, feasts). Tracks active status (`completed`, `pending`, `off_day`, `broken`), longest streak, and milestone goals.
- **Multi-Window Redis Leaderboards:** Real-time cohort rankings across **weekly**, **monthly**, and **all-time** windows powered by Redis Sorted Sets (`ZINCRBY`, `ZREVRANGE`).
- **Bilingual AI Comprehension Generator:** Uses Google Gemini (with deterministic local fallbacks) constrained by strict JSON schemas to craft grade-appropriate multiple-choice and true/false questions.
- **Servant Roster & Admin Reports:** Live daily completion rosters and question tracking for Sunday School servants and administrators.
- **Dual Runtime Resilience:** Full PostgreSQL + Redis production capability with an automatic **active in-memory fallback** for rapid offline development, testing, and Swagger demonstrations.

---

## 🏗️ Architecture & Data Flow

```mermaid
graph TD
    Client[Mobile App / Web Client] -->|HTTP / JSON| Gateway[Fastify API Gateway & Identity Middleware]
    
    subgraph "API Modules (/api/v1)"
        Gateway --> ReadingsMod[Readings Module]
        Gateway --> StreakMod[Streaks Module]
        Gateway --> SubmissionsMod[Submissions Module]
        Gateway --> LeaderboardMod[Leaderboard Module]
        Gateway --> AIMod[AI Generation Module]
        Gateway --> AdminMod[Admin & Servant Module]
    end

    subgraph "Data & Persistence Layer"
        SubmissionsMod -->|Atomic Transaction| PG[(PostgreSQL / MemoryDB)]
        StreakMod -->|Streak Integrity Engine| PG
        ReadingsMod -->|Scripture & Diacritics| PG
        SubmissionsMod -->|Async Score Recording| Redis[(Redis ZSETs)]
        LeaderboardMod -->|ZREVRANGE| Redis
        AIMod -->|Gemini API with Fallback| GoogleAI[Google Gemini 2.5]
    end
```

---

## 🔥 Scheduled-Day Streak Engine

Standard calendar-day streaks unfairly penalize students when church curricula pause on Sundays, holidays, or liturgical fast days. Evangelion implements a **Scheduled-Day Streak Integrity Engine**:

```mermaid
flowchart TD
    Start([Student Opens App or Submits Reading]) --> CheckToday{Is reading scheduled today?}
    
    CheckToday -- No (Off-Day) --> PreserveOffDay[Streak Preserved! Status: 'off_day']
    CheckToday -- Yes --> CheckCompleted{All questions answered today?}
    
    CheckCompleted -- Yes --> IncStreak[Streak = 1 + Past Consecutive Scheduled Days<br/>Status: 'completed']
    CheckCompleted -- No --> CheckPrev{Was previous scheduled reading completed?}
    
    CheckPrev -- Yes --> StreakPending[Active Streak Intact! Status: 'pending'<br/>Waiting for submission before midnight]
    CheckPrev -- No --> StreakBroken[Streak Reset to 0.<br/>Status: 'broken']
    
    IncStreak --> UpdateMilestone[Update Longest Streak & Calculate Next Milestone]
    PreserveOffDay --> UpdateMilestone
    StreakPending --> UpdateMilestone
    StreakBroken --> UpdateMilestone
```

### Streak Statuses
| Status | Meaning | Streak Action |
| :--- | :--- | :--- |
| `completed` | Student has submitted all questions for today's reading. | Streak increments. |
| `pending` | Today is scheduled; student has not yet finished, but previous scheduled day was completed. | Streak is preserved and at risk; not broken until today lapses. |
| `off_day` | No reading scheduled for this cohort today (e.g. Sunday / Feast). | Streak is safely preserved from last scheduled day. |
| `broken` | A previous scheduled reading day was missed. | Streak resets to 0 (or restarts on next completion). |

---

## 👥 Sunday School Cohorts (7 Groups)

| Group ID | Cohort Name | Target Grades | Gender Category |
| :---: | :--- | :---: | :---: |
| **1** | Grade 3 & 4 Boys | Grades 3–4 | `boys` |
| **2** | Grade 3 & 4 Girls | Grades 3–4 | `girls` |
| **3** | Grade 5 & 6 Boys | Grades 5–6 | `boys` |
| **4** | Grade 5 & 6 Girls | Grades 5–6 | `girls` |
| **5** | Grade 6, 7 & 8 Boys | Grades 6–8 | `boys` |
| **6** | Grade 6, 7 & 8 Girls | Grades 6–8 | `girls` |
| **7** | Grade 10, 11 & 12 Mixed | Grades 10–12 | `mixed` |

---

## 🚀 Quick Start & Installation

### 1. Prerequisites
- **Node.js**: `v20.x` or higher
- **npm**: `v10.x` or higher
- **Docker & Docker Compose** (Optional for local PostgreSQL and Redis)

### 2. Clone & Install Dependencies
```bash
cd d:\Evangelion\Backend
npm install
```

### 3. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Key configuration parameters in `.env`:
```ini
PORT=3000
NODE_ENV=development
DATABASE_URL=postgres://evangelion:evangelion_dev_password@localhost:5432/evangelion_db
REDIS_URL=redis://localhost:6379
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash
CHURCH_TIMEZONE=Africa/Cairo
```

### 4. Start Infrastructure (Docker)
```bash
docker compose up -d
```
*(Note: If Docker is not running, the backend seamlessly activates the active **in-memory database fallback** so you can develop and test offline immediately).*

### 5. Run Database Migrations & Seed Data
```bash
npm run migrate
```
To load full bilingual Scripture text into PostgreSQL:
```bash
npm run import-bible
```

### 6. Run Development Server
```bash
npm run dev
```
Server starts at `http://localhost:3000`. Interactive Swagger UI is available at **`http://localhost:3000/docs`**.

### 7. Run Test Suite
```bash
npm test
```
Runs 26 Vitest unit and integration tests covering verse assembly, AI validation, leaderboard rankings, API routes, and daily streaks.

---

## 📡 API Reference

### Global Request Headers
| Header | Type | Description |
| :--- | :--- | :--- |
| `X-User-Id` | `UUID` | ID of the authenticated student or servant. |
| `X-Group-Id` | `number` | Cohort Group ID (1 to 7). |
| `X-User-Role` | `string` | User role: `kid` \| `viewer_servant` \| `admin_servant`. |

---

### 1. System & Health
- **`GET /health`**  
  Service health status, timestamp, and Swagger link.
- **`GET /docs`**  
  Interactive Swagger UI documentation.
- **`GET /docs/json`**  
  Raw OpenAPI 3.0 specification.

---

### 2. Daily Readings
- **`GET /api/v1/readings/today/ar`**  
  *Headers:* `X-Group-Id`, `X-User-Id`  
  *Query:* `?date=YYYY-MM-DD`  
  Returns today's passage in Arabic (Smith & Van Dyck) with vocalization (tashkeel), diacritic-clean text, Arabic reference, comprehension questions, and user streak.
- **`GET /api/v1/readings/today/en`**  
  *Headers:* `X-Group-Id`, `X-User-Id`  
  *Query:* `?date=YYYY-MM-DD`  
  Returns today's passage in English (NKJV) with comprehension questions and user streak.
- **`GET /api/v1/readings/today`**  
  *Headers:* `X-Group-Id`, `X-User-Id`  
  *Query:* `?date=YYYY-MM-DD&lang=ar|en`  
  Returns parallel bilingual passage verses and questions (or localized when `?lang` is passed).

---

### 3. Scripture Reader (Passage Lookup)
- **`GET /api/v1/bible/verses/ar`**  
  *Query:* `book_number=43&start_chapter=3&start_verse=1&end_verse=16`  
  Extracts Arabic verses with tashkeel and clean search text.
- **`GET /api/v1/bible/verses/en`**  
  *Query:* `book_number=43&start_chapter=3&start_verse=1&end_verse=16`  
  Extracts English NKJV verses.
- **`GET /api/v1/bible/verses`**  
  *Query:* `book_number=43&start_chapter=1&start_verse=35&end_chapter=2&end_verse=5`  
  Extracts cross-chapter verse range with side-by-side Arabic and English text.

---

### 4. Daily Streaks
- **`GET /api/v1/streak`**  
  *Headers:* `X-User-Id` (required), `X-Group-Id` (optional)  
  *Query:* `?date=YYYY-MM-DD` (optional date override)  
  *Response:*
  ```json
  {
    "user_id": "11111111-1111-1111-1111-111111111111",
    "group_id": 3,
    "current_streak": 4,
    "longest_streak": 7,
    "last_completed_date": "2026-09-30",
    "today_date": "2026-09-30",
    "today_scheduled": true,
    "today_completed": true,
    "today_status": "completed",
    "next_milestone": 7,
    "days_to_milestone": 3,
    "history": [
      {
        "reading_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        "scheduled_date": "2026-09-30",
        "book_number": 43,
        "book_name_ar": "يوحنا",
        "book_name_en": "John",
        "reference": { "ar": "يوحنا 3: 1-5", "en": "John 3:1-5" },
        "total_questions": 1,
        "answered_questions": 1,
        "correct_answers": 1,
        "points_earned": 10,
        "is_completed": true
      }
    ]
  }
  ```
- **`GET /api/v1/streak/summary`**  
  *Headers:* `X-User-Id`  
  *Response:* Concise payload (without full history array) ideal for mobile headers and streak widgets.

---

### 5. Question Submissions
- **`POST /api/v1/readings/:id/submit`**  
  *Headers:* `X-User-Id`  
  *Body:*
  ```json
  {
    "question_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    "answer": "A"
  }
  ```
  *Response:*
  ```json
  {
    "question_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    "is_correct": true,
    "points_earned": 10,
    "current_total_points": 60,
    "current_streak": 5,
    "longest_streak": 7,
    "reading_completed": true
  }
  ```
  *Error 409 Conflict:* Returned if question has already been submitted (idempotency guard).

---

### 6. Leaderboards
- **`GET /api/v1/leaderboard`**  
  *Headers:* `X-Group-Id`, `X-User-Id` (optional for individual standing)  
  *Query:* `?window=weekly|monthly|all_time&limit=50`  
  Returns ranked students with scores, current streaks, and caller's standing.

---

### 7. AI Question Generation
- **`POST /api/v1/ai/generate-questions`**  
  *Headers:* `X-User-Role: admin_servant`  
  *Body:*
  ```json
  {
    "book_number": 43,
    "start_chapter": 3,
    "start_verse": 1,
    "end_chapter": 3,
    "end_verse": 5,
    "target_group_ids": [3],
    "type": "mcq"
  }
  ```
  Generates bilingual questions tailored to the target cohort grades using Gemini 2.5.

---

### 8. Admin & Servant Operations
- **`POST /api/v1/admin/readings/schedule`**  
  Atomically provisions cross-chapter readings for multiple groups with optional `generate_ai_questions: true`.
- **`POST /api/v1/admin/questions/commit`**  
  Replaces or adds approved questions for a reading.
- **`GET /api/v1/servant/reports/daily`**  
  *Query:* `group_id=3&date=2026-09-30`  
  Returns full roster completion report with points earned today and current streaks.

---

## 📬 Postman Collection & Environment

Two ready-to-import Postman files are included in the repository root:
1. **[`postman_collection.json`](file:///d:/Evangelion/Backend/postman_collection.json):** All 8 route modules, 19 requests, with pre-configured assertions and variable propagation.
2. **[`postman_environment.json`](file:///d:/Evangelion/Backend/postman_environment.json):** Pre-configured environment variables (`baseUrl`, `groupId`, `userId`, `readingId`, `questionId`, `targetDate`).

### How to Import & Run in Postman:
1. Open **Postman** -> Click **Import**.
2. Select `postman_collection.json` and `postman_environment.json`.
3. In the top-right environment selector, choose **"Evangelion Local Environment"**.
4. Run requests individually or execute the entire folder with the **Postman Collection Runner**!
   *(Test scripts automatically capture `readingId` and `questionId` from daily reading responses for seamless submission tests).*

---

## 🧪 Testing

The repository uses [Vitest](https://vitest.dev) for high-speed test execution:
```bash
# Run all tests once
npm test

# Run tests in watch mode
npx vitest

# Run TypeScript build check
npm run build
```

---

## 📜 License
MIT License. Created for Church Sunday School Bible Reading & Spiritual Growth Platforms.
