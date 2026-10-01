import { query } from '../../db/pool.js';

export interface BibleVerseRow {
  book_number: number;
  chapter: number;
  verse: number;
  text_ar: string;
  text_ar_clean: string;
  text_en: string;
}

export interface ExcludedVerse {
  chapter: number;
  verse: number;
}

export interface DailyReadingWithDetails {
  reading_id: string;
  group_id: number;
  scheduled_date: string;
  reference: {
    ar: string;
    en: string;
  };
  translation: {
    ar: string;
    en: string;
  };
  verses: BibleVerseRow[];
  questions: Array<{
    id: string;
    sort_order: number;
    type: 'mcq' | 'true_false' | 'short_answer';
    prompt_ar: string;
    prompt_en: string;
    options: Record<string, { ar: string; en: string }> | null;
    points_value: number;
    already_answered: boolean;
    user_answer: string | null;
    is_correct: boolean | null;
  }>;
  is_fully_completed: boolean;
  total_points_earned_today: number;
  current_streak: number;
}

export interface LocalizedDailyReading {
  reading_id: string;
  group_id: number;
  scheduled_date: string;
  language: 'ar' | 'en';
  reference: string;
  translation: string;
  verses: Array<{
    book_number: number;
    chapter: number;
    verse: number;
    text: string;
    text_clean?: string;
  }>;
  questions: Array<{
    id: string;
    sort_order: number;
    type: 'mcq' | 'true_false' | 'short_answer';
    prompt: string;
    options: Record<string, string> | null;
    points_value: number;
    already_answered: boolean;
    user_answer: string | null;
    is_correct: boolean | null;
  }>;
  is_fully_completed: boolean;
  total_points_earned_today: number;
  current_streak: number;
}

export class ReadingsService {
  async extractVerses(
    bookNumber: number,
    startChapter: number,
    startVerse: number,
    endChapter: number,
    endVerse: number,
    excludedVerses: ExcludedVerse[] = []
  ): Promise<BibleVerseRow[]> {
    const sql = `
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
          ($2 = $4 AND chapter = $2 AND verse BETWEEN $3 AND $5)
          OR
          ($2 < $4 AND chapter = $2 AND verse >= $3)
          OR
          ($2 < $4 AND chapter > $2 AND chapter < $4)
          OR
          ($2 < $4 AND chapter = $4 AND verse <= $5)
        )
        AND NOT EXISTS (
          SELECT 1 
          FROM jsonb_to_recordset($6::jsonb) AS ex(chapter INT, verse INT)
          WHERE ex.chapter = bible_verses.chapter 
            AND ex.verse = bible_verses.verse
        )
      ORDER BY chapter ASC, verse ASC;
    `;

    const res = await query<BibleVerseRow>(sql, [
      bookNumber,
      startChapter,
      startVerse,
      endChapter,
      endVerse,
      JSON.stringify(excludedVerses)
    ]);

    return res.rows;
  }

  async getTodayReadingForGroup(
    groupId: number,
    userId?: string,
    scheduledDate: string = new Date().toISOString().split('T')[0]
  ): Promise<DailyReadingWithDetails | null> {
    // 1. Fetch reading
    const readingRes = await query(`
      SELECT 
        dr.id, dr.group_id, dr.scheduled_date, dr.book_number,
        dr.start_chapter, dr.start_verse, dr.end_chapter, dr.end_verse,
        dr.excluded_verses,
        bv.book_name_en, bv.book_name_ar
      FROM daily_readings dr
      LEFT JOIN bible_verses bv ON bv.book_number = dr.book_number
      WHERE dr.group_id = $1 AND dr.scheduled_date = $2
      LIMIT 1
    `, [groupId, scheduledDate]);

    if (readingRes.rows.length === 0) {
      return null;
    }

    const r = readingRes.rows[0];

    // 2. Extract verses
    const verses = await this.extractVerses(
      r.book_number,
      r.start_chapter,
      r.start_verse,
      r.end_chapter,
      r.end_verse,
      r.excluded_verses || []
    );

    // 3. Fetch questions
    const questionsRes = await query(`
      SELECT 
        q.id, q.sort_order, q.type, q.prompt_ar, q.prompt_en,
        q.options, q.points_value,
        s.answer_text AS user_answer,
        s.is_correct
      FROM questions q
      LEFT JOIN submissions s ON s.question_id = q.id AND s.user_id = $2
      WHERE q.reading_id = $1 AND q.is_approved = TRUE
      ORDER BY q.sort_order ASC
    `, [r.id, userId || null]);

    let totalPointsEarned = 0;
    const questions = questionsRes.rows.map(q => {
      const answered = q.user_answer !== null && q.user_answer !== undefined;
      if (q.is_correct) {
        totalPointsEarned += q.points_value;
      }
      return {
        id: q.id,
        sort_order: q.sort_order,
        type: q.type,
        prompt_ar: q.prompt_ar,
        prompt_en: q.prompt_en,
        options: q.options,
        points_value: q.points_value,
        already_answered: answered,
        user_answer: q.user_answer,
        is_correct: q.is_correct
      };
    });

    const isFullyCompleted = questions.length > 0 && questions.every(q => q.already_answered);

    // Build reference string
    const bookEn = r.book_name_en || `Book ${r.book_number}`;
    const bookAr = r.book_name_ar || `سفر ${r.book_number}`;
    
    let refEn: string;
    let refAr: string;
    if (r.start_chapter === r.end_chapter) {
      refEn = `${bookEn} ${r.start_chapter}:${r.start_verse}-${r.end_verse}`;
      refAr = `${bookAr} ${r.start_chapter}: ${r.start_verse}-${r.end_verse}`;
    } else {
      refEn = `${bookEn} ${r.start_chapter}:${r.start_verse} - ${r.end_chapter}:${r.end_verse}`;
      refAr = `${bookAr} ${r.start_chapter}: ${r.start_verse} - ${r.end_chapter}: ${r.end_verse}`;
    }

    let userStreak = 0;
    if (userId) {
      const uRes = await query('SELECT current_streak FROM users WHERE id = $1', [userId]);
      if (uRes.rows.length > 0) {
        userStreak = uRes.rows[0].current_streak || 0;
      }
    }

    return {
      reading_id: r.id,
      group_id: r.group_id,
      scheduled_date: r.scheduled_date,
      reference: { ar: refAr, en: refEn },
      translation: {
        ar: 'Smith & Van Dyck (فانديك)',
        en: 'NKJV (New King James Version)'
      },
      verses,
      questions,
      is_fully_completed: isFullyCompleted,
      total_points_earned_today: totalPointsEarned,
      current_streak: userStreak
    };
  }

  formatLocalizedReading(reading: DailyReadingWithDetails, lang: 'ar' | 'en'): LocalizedDailyReading {
    const isAr = lang === 'ar';
    return {
      reading_id: reading.reading_id,
      group_id: reading.group_id,
      scheduled_date: reading.scheduled_date,
      language: lang,
      reference: isAr ? reading.reference.ar : reading.reference.en,
      translation: isAr ? reading.translation.ar : reading.translation.en,
      is_fully_completed: reading.is_fully_completed,
      total_points_earned_today: reading.total_points_earned_today,
      current_streak: reading.current_streak,
      verses: reading.verses.map(v => ({
        book_number: v.book_number,
        chapter: v.chapter,
        verse: v.verse,
        text: isAr ? v.text_ar : v.text_en,
        ...(isAr ? { text_clean: v.text_ar_clean } : {})
      })),
      questions: reading.questions.map(q => {
        let localizedOptions: Record<string, string> | null = null;
        if (q.options) {
          localizedOptions = {};
          for (const [key, val] of Object.entries(q.options)) {
            localizedOptions[key] = isAr ? (val?.ar || '') : (val?.en || '');
          }
        }
        return {
          id: q.id,
          sort_order: q.sort_order,
          type: q.type,
          prompt: isAr ? q.prompt_ar : q.prompt_en,
          options: localizedOptions,
          points_value: q.points_value,
          already_answered: q.already_answered,
          user_answer: q.user_answer,
          is_correct: q.is_correct
        };
      })
    };
  }

  async getBookNames(bookNumber: number): Promise<{ ar: string; en: string }> {
    const res = await query(`
      SELECT book_name_ar, book_name_en FROM bible_verses WHERE book_number = $1 LIMIT 1
    `, [bookNumber]);
    if (res.rows.length > 0) {
      return { ar: res.rows[0].book_name_ar, en: res.rows[0].book_name_en };
    }
    return { ar: `سفر ${bookNumber}`, en: `Book ${bookNumber}` };
  }
}

export const readingsService = new ReadingsService();
