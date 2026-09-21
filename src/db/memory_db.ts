// In-Memory Database Fallback for Development and Swagger Testing when PostgreSQL is not running
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


export interface MockGroup {
  id: number;
  name: string;
  gender: string;
  min_grade: number;
  max_grade: number;
}

export interface MockUser {
  id: string;
  group_id: number;
  full_name: string;
  username: string;
  role: string;
  preferred_lang: string;
  total_points: number;
  current_streak: number;
  is_active: boolean;
}

export interface MockVerse {
  book_number: number;
  book_name_en: string;
  book_name_ar: string;
  chapter: number;
  verse: number;
  text_en: string;
  text_ar: string;
  text_ar_clean: string;
}

export interface MockReading {
  id: string;
  group_id: number;
  scheduled_date: string;
  book_number: number;
  start_chapter: number;
  start_verse: number;
  end_chapter: number;
  end_verse: number;
  excluded_verses: any[];
}

export interface MockQuestion {
  id: string;
  reading_id: string;
  type: string;
  prompt_ar: string;
  prompt_en: string;
  options: any;
  correct_answer: string;
  points_value: number;
  sort_order: number;
  is_approved: boolean;
}

export interface MockSubmission {
  id: string;
  user_id: string;
  reading_id: string;
  question_id: string;
  answer_text: string;
  is_correct: boolean;
  points_awarded: number;
  submitted_at: Date;
}

export class InMemoryDatabase {
  groups: MockGroup[] = [
    { id: 1, name: 'Grade 3 & 4 Boys', gender: 'boys', min_grade: 3, max_grade: 4 },
    { id: 2, name: 'Grade 3 & 4 Girls', gender: 'girls', min_grade: 3, max_grade: 4 },
    { id: 3, name: 'Grade 5 & 6 Boys', gender: 'boys', min_grade: 5, max_grade: 6 },
    { id: 4, name: 'Grade 5 & 6 Girls', gender: 'girls', min_grade: 5, max_grade: 6 },
    { id: 5, name: 'Grade 6, 7 & 8 Boys', gender: 'boys', min_grade: 6, max_grade: 8 },
    { id: 6, name: 'Grade 6, 7 & 8 Girls', gender: 'girls', min_grade: 6, max_grade: 8 },
    { id: 7, name: 'Grade 10, 11 & 12 Mixed', gender: 'mixed', min_grade: 10, max_grade: 12 }
  ];

  users: MockUser[] = [
    { id: '11111111-1111-1111-1111-111111111111', group_id: 3, full_name: 'David Mina (Grade 5)', username: 'david_mina', role: 'kid', preferred_lang: 'ar', total_points: 50, current_streak: 4, is_active: true },
    { id: '22222222-2222-2222-2222-222222222222', group_id: 3, full_name: 'Peter George (Grade 6)', username: 'peter_george', role: 'kid', preferred_lang: 'ar', total_points: 80, current_streak: 7, is_active: true },
    { id: '33333333-3333-3333-3333-333333333333', group_id: 3, full_name: 'Mark Anton (Grade 5)', username: 'mark_anton', role: 'kid', preferred_lang: 'en', total_points: 30, current_streak: 2, is_active: true },
    { id: '99999999-9999-9999-9999-999999999999', group_id: 0, full_name: 'Servant Michael', username: 'servant_michael', role: 'admin_servant', preferred_lang: 'ar', total_points: 0, current_streak: 0, is_active: true }
  ];

  verses: MockVerse[] = [
    { book_number: 43, book_name_en: 'John', book_name_ar: 'يوحنا', chapter: 1, verse: 35, text_en: 'Again, the next day, John stood with two of his disciples.', text_ar: 'وَفِي الْغَدِ أَيْضاً كَانَ يُوحَنَّا وَاقِفاً هُوَ وَاثْنَانِ مِنْ تَلَامِيذِهِ،', text_ar_clean: 'وفي الغد ايضا كان يوحنا واقفا هو واثنان من تلاميذه،' },
    { book_number: 43, book_name_en: 'John', book_name_ar: 'يوحنا', chapter: 1, verse: 36, text_en: 'And looking at Jesus as He walked, he said, "Behold the Lamb of God!"', text_ar: 'فَنَظَرَ إِلَى يَسُوعَ مَاشِياً، فَقَالَ: «هُوَذَا حَمَلُ اللهِ!».', text_ar_clean: 'فنظر الى يسوع ماشيا، فقال: «هوذا حمل الله!».'},
    { book_number: 43, book_name_en: 'John', book_name_ar: 'يوحنا', chapter: 1, verse: 37, text_en: 'The two disciples heard him speak, and they followed Jesus.', text_ar: 'فَسَمِعَهُ التِّلْمِيذَانِ يَتَكَلَّمُ، فَتَبِعَا يَسُوعَ.', text_ar_clean: 'فسمعه التلميذان يتكلم، فتبعا يسوع.' },
    { book_number: 43, book_name_en: 'John', book_name_ar: 'يوحنا', chapter: 2, verse: 1, text_en: 'On the third day there was a wedding in Cana of Galilee, and the mother of Jesus was there.', text_ar: 'وَفِي الْيَوْمِ الثَّالِثِ كَانَ عُرْسٌ فِي قَانَا الْجَلِيلِ، وَكَانَتْ أُمُّ يَسُوعَ هُنَاكَ.', text_ar_clean: 'وفي اليوم الثالث كان عرس في قانا الجليل، وكانت ام يسوع هناك.' },
    { book_number: 43, book_name_en: 'John', book_name_ar: 'يوحنا', chapter: 2, verse: 2, text_en: 'Now both Jesus and His disciples were invited to the wedding.', text_ar: 'وَدُعِيَ أَيْضاً يَسُوعُ وَتَلَامِيذُهُ إِلَى الْعُرْسِ.', text_ar_clean: 'ودعي ايضا يسوع وتلاميذه الى العرس.' },
    { book_number: 43, book_name_en: 'John', book_name_ar: 'يوحنا', chapter: 3, verse: 1, text_en: 'There was a man of the Pharisees named Nicodemus, a ruler of the Jews.', text_ar: 'كَانَ إِنْسَانٌ مِنَ الْفَرِّيسِيِّينَ اسْمُهُ نِيقُودِيمُوسُ، رَئِيسٌ لِلْيَهُودِ.', text_ar_clean: 'كان انسان من الفريسيين اسمه نيقوديموس، رئيس لليهود.' },
    { book_number: 43, book_name_en: 'John', book_name_ar: 'يوحنا', chapter: 3, verse: 2, text_en: 'This man came to Jesus by night and said to Him, "Rabbi, we know that You are a teacher come from God; for no one can do these signs that You do unless God is with him."', text_ar: 'هَذَا جَاءَ إِلَى يَسُوعَ لَيْلاً وَقَالَ لَهُ: «يَا مُعَلِّمُ، نَعْلَمُ أَنَّكَ قَدْ أَتَيْتَ مِنَ اللهِ مُعَلِّماً، لأَنَّهُ لَيْسَ أَحَدٌ يَقْدِرُ أَنْ يَعْمَلَ هَذِهِ الآيَاتِ الَّتِي أَنْتَ تَعْمَلُ إِنْ لَمْ يَكُنِ اللهُ مَعَهُ».', text_ar_clean: 'هذا جاء الى يسوع ليلا وقال له: «يا معلم، نعلم انك قد اتيت من الله معلما، لانه ليس احد يقدر ان يعمل هذه الايات التي انت تعمل ان لم يكن الله معه».' },
    { book_number: 43, book_name_en: 'John', book_name_ar: 'يوحنا', chapter: 3, verse: 3, text_en: 'Jesus answered and said to him, "Most assuredly, I say to you, unless one is born again, he cannot see the kingdom of God."', text_ar: 'أَجَابَ يَسُوعُ وَقَالَ لَهُ: «الْحَقَّ الْحَقَّ أَقُولُ لَكَ: إِنْ كَانَ أَحَدٌ لاَ يُولَدُ مِنْ فَوْقُ لاَ يَقْدِرُ أَنْ يَرَى مَلَكُوتَ اللهِ».', text_ar_clean: 'اجاب يسوع وقال له: «الحق الحق اقول لك: ان كان احد لا يولد من فوق لا يقدر ان يرى ملكوت الله».' },
    { book_number: 43, book_name_en: 'John', book_name_ar: 'يوحنا', chapter: 3, verse: 4, text_en: 'Nicodemus said to Him, "How can a man be born when he is old? Can he enter a second time into his mother\'s womb and be born?"', text_ar: 'قَالَ لَهُ نِيقُودِيمُوسُ: «كَيْفَ يُمْكِنُ الإِنْسَانَ أَنْ يُولَدَ وَهُوَ شَيْخٌ؟ أَلَعَلَّهُ يَقْدِرُ أَنْ يَدْخُلَ بَطْنَ أُمِّهِ ثَانِيَةً وَيُولَدَ؟».', text_ar_clean: 'قال له نيقوديموس: «كيف يمكن الانسان ان يولد وهو شيخ؟ العله يقدر ان يدخل بطن امه ثانية ويولد؟».' },
    { book_number: 43, book_name_en: 'John', book_name_ar: 'يوحنا', chapter: 3, verse: 5, text_en: 'Jesus answered, "Most assuredly, I say to you, unless one is born of water and the Spirit, he cannot enter the kingdom of God."', text_ar: 'أَجَابَ يَسُوعُ: «الْحَقَّ الْحَقَّ أَقُولُ لَكَ: إِنْ كَانَ أَحَدٌ لاَ يُولَدُ مِنَ الْمَاءِ وَالرُّوحِ لاَ يَقْدِرُ أَنْ يَدْخُلَ مَلَكُوتَ اللهِ».', text_ar_clean: 'اجاب يسوع: «الحق الحق اقول لك: ان كان احد لا يولد من الماء والروح لا يقدر ان يدخل ملكوت الله».' }
  ];

  readings: MockReading[] = [
    {
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      group_id: 3,
      scheduled_date: new Date().toISOString().split('T')[0],
      book_number: 43,
      start_chapter: 3,
      start_verse: 1,
      end_chapter: 3,
      end_verse: 5,
      excluded_verses: []
    }
  ];

  questions: MockQuestion[] = [
    {
      id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      reading_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      type: 'mcq',
      prompt_ar: 'مَا اسْمُ الرَّجُلِ الْفَرِّيسِيِّ الَّذِي جَاءَ إِلَى يَسُوعَ لَيْلاً؟',
      prompt_en: 'What was the name of the Pharisee who came to Jesus by night?',
      options: {
        A: { ar: 'نِيقُودِيمُوسُ', en: 'Nicodemus' },
        B: { ar: 'بُولُسُ', en: 'Paul' },
        C: { ar: 'بُطْرُسُ', en: 'Peter' },
        D: { ar: 'لِعَازَرُ', en: 'Lazarus' }
      },
      correct_answer: 'A',
      points_value: 10,
      sort_order: 1,
      is_approved: true
    }
  ];

  submissions: MockSubmission[] = [];

  constructor() {
    this.loadBibleData();
  }

  private loadBibleData(): void {
    try {
      const candidates = [
        path.join(__dirname, 'bible_data.json'),
        path.join(process.cwd(), 'src', 'db', 'bible_data.json')
      ];
      for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
          const raw = fs.readFileSync(candidate, 'utf-8');
          const loaded = JSON.parse(raw);
          if (Array.isArray(loaded) && loaded.length > 0) {
            this.verses = loaded;
            break;
          }
        }
      }
    } catch {
      // Keep sample verses if loading fails
    }
  }

  async executeQuery(text: string, params: any[] = []): Promise<{ rows: any[]; rowCount: number }> {
    const t = text.trim().toLowerCase();

    // Transactions
    if (t === 'begin' || t === 'commit' || t === 'rollback') {
      return { rows: [], rowCount: 0 };
    }

    // 1. bible_verses extraction
    if (t.includes('select book_name_ar, book_name_en from bible_verses')) {
      const bookNumber = params[0] || 1;
      const v = this.verses.find(verse => verse.book_number === bookNumber);
      return {
        rows: v ? [{ book_name_ar: v.book_name_ar, book_name_en: v.book_name_en }] : [],
        rowCount: v ? 1 : 0
      };
    }

    if (t.includes('from bible_verses')) {
      const bookNumber = params[0] || 43;
      const startChapter = params[1] || 1;
      const startVerse = params[2] || 1;
      const endChapter = params[3] || 99;
      const endVerse = params[4] || 99;

      let exList: any[] = [];
      try {
        if (params[5]) exList = typeof params[5] === 'string' ? JSON.parse(params[5]) : params[5];
      } catch (e) {}

      const rows = this.verses.filter(v => {
        if (v.book_number !== bookNumber) return false;
        
        let inRange = false;
        if (startChapter === endChapter) {
          inRange = v.chapter === startChapter && v.verse >= startVerse && v.verse <= endVerse;
        } else {
          if (v.chapter === startChapter && v.verse >= startVerse) inRange = true;
          else if (v.chapter > startChapter && v.chapter < endChapter) inRange = true;
          else if (v.chapter === endChapter && v.verse <= endVerse) inRange = true;
        }
        if (!inRange) return false;

        // Exclusions
        const isExcluded = exList.some(ex => ex.chapter === v.chapter && ex.verse === v.verse);
        return !isExcluded;
      }).map(v => ({
        book_number: v.book_number,
        chapter: v.chapter,
        verse: v.verse,
        text_ar: v.text_ar,
        text_ar_clean: v.text_ar_clean,
        text_en: v.text_en
      }));

      return { rows, rowCount: rows.length };
    }

    // 2. GET daily reading for group
    if (t.includes('from daily_readings dr') && t.includes('where dr.group_id = $1')) {
      const groupId = params[0];
      const scheduledDate = params[1] || new Date().toISOString().split('T')[0];

      let reading = this.readings.find(r => r.group_id === groupId && r.scheduled_date === scheduledDate);
      if (!reading) {
        // Auto-provision reading for group so all groups work in Swagger demo
        const newId = `reading-group-${groupId}-${scheduledDate}`;
        reading = {
          id: newId,
          group_id: groupId,
          scheduled_date: scheduledDate,
          book_number: 43,
          start_chapter: 3,
          start_verse: 1,
          end_chapter: 3,
          end_verse: 5,
          excluded_verses: []
        };
        this.readings.push(reading);

        // Also add a sample question
        this.questions.push({
          id: `question-group-${groupId}`,
          reading_id: newId,
          type: 'mcq',
          prompt_ar: 'مَا اسْمُ الرَّجُلِ الَّذِي جَاءَ إِلَى يَسُوعَ لَيْلاً؟',
          prompt_en: 'What was the name of the man who came to Jesus by night?',
          options: {
            A: { ar: 'نِيقُودِيمُوسُ', en: 'Nicodemus' },
            B: { ar: 'بُولُسُ', en: 'Paul' },
            C: { ar: 'بُطْرُسُ', en: 'Peter' },
            D: { ar: 'لِعَازَرُ', en: 'Lazarus' }
          },
          correct_answer: 'A',
          points_value: 10,
          sort_order: 1,
          is_approved: true
        });
      }

      const sampleVerse = this.verses.find(v => v.book_number === reading.book_number);
      const row = {
        id: reading.id,
        group_id: reading.group_id,
        scheduled_date: reading.scheduled_date,
        book_number: reading.book_number,
        start_chapter: reading.start_chapter,
        start_verse: reading.start_verse,
        end_chapter: reading.end_chapter,
        end_verse: reading.end_verse,
        excluded_verses: reading.excluded_verses,
        book_name_en: sampleVerse?.book_name_en || 'Bible',
        book_name_ar: sampleVerse?.book_name_ar || 'الكتاب المقدس'
      };
      return { rows: [row], rowCount: 1 };
    }

    // 3. GET questions for reading
    if (t.includes('from questions q') && t.includes('where q.reading_id = $1')) {
      const readingId = params[0];
      const userId = params[1];

      const qs = this.questions.filter(q => q.reading_id === readingId);
      const rows = qs.map(q => {
        const sub = this.submissions.find(s => s.question_id === q.id && s.user_id === userId);
        return {
          id: q.id,
          sort_order: q.sort_order,
          type: q.type,
          prompt_ar: q.prompt_ar,
          prompt_en: q.prompt_en,
          options: q.options,
          points_value: q.points_value,
          user_answer: sub ? sub.answer_text : null,
          is_correct: sub ? sub.is_correct : null
        };
      });
      return { rows, rowCount: rows.length };
    }

    // 4. Check existing submission
    if (t.includes('from submissions where user_id = $1 and question_id = $2')) {
      const [userId, questionId] = params;
      const found = this.submissions.filter(s => s.user_id === userId && s.question_id === questionId);
      return { rows: found, rowCount: found.length };
    }

    // 5. Select question details
    if (t.includes('from questions where id = $1')) {
      const qId = params[0];
      const found = this.questions.filter(q => q.id === qId);
      return { rows: found, rowCount: found.length };
    }

    // 6. Select user
    if (t.includes('from users where id = $1')) {
      const uId = params[0];
      let found = this.users.find(u => u.id === uId);
      if (!found) {
        // Auto-provision mock kid user so any UUID works in Swagger
        found = {
          id: uId,
          group_id: 3,
          full_name: 'Student ' + uId.slice(0, 8),
          username: 'user_' + uId.slice(0, 8),
          role: 'kid',
          preferred_lang: 'ar',
          total_points: 0,
          current_streak: 0,
          is_active: true
        };
        this.users.push(found);
      }
      return { rows: [found], rowCount: 1 };
    }

    // 7. Insert submission
    if (t.includes('insert into submissions')) {
      const [userId, readingId, questionId, answerText, isCorrect, pointsAwarded] = params;
      const newSub: MockSubmission = {
        id: 'sub-' + Date.now(),
        user_id: userId,
        reading_id: readingId,
        question_id: questionId,
        answer_text: answerText,
        is_correct: isCorrect,
        points_awarded: pointsAwarded,
        submitted_at: new Date()
      };
      this.submissions.push(newSub);
      return { rows: [newSub], rowCount: 1 };
    }

    // 8. Update user points
    if (t.includes('update users set total_points = total_points + $1')) {
      const [points, userId] = params;
      const u = this.users.find(usr => usr.id === userId);
      if (u) u.total_points += points;
      return { rows: [], rowCount: 1 };
    }

    // 9. Count questions and answered
    if (t.includes('select count(*) as total from questions')) {
      const readingId = params[0];
      const total = this.questions.filter(q => q.reading_id === readingId).length;
      return { rows: [{ total }], rowCount: 1 };
    }
    if (t.includes('select count(*) as answered from submissions')) {
      const [readingId, userId] = params;
      const answered = this.submissions.filter(s => s.reading_id === readingId && s.user_id === userId).length;
      return { rows: [{ answered }], rowCount: 1 };
    }

    // 10. Update user streak
    if (t.includes('update users set current_streak = $1')) {
      const [streak, userId] = params;
      const u = this.users.find(usr => usr.id === userId);
      if (u) u.current_streak = streak;
      return { rows: [], rowCount: 1 };
    }

    // 11. Schedule readings (with ON CONFLICT DO UPDATE behavior)
    if (t.includes('insert into daily_readings')) {
      const [groupId, scheduledDate, bookNumber, startCh, startV, endCh, endV, exJson] = params;
      let ex = [];
      try { ex = JSON.parse(exJson); } catch (e) {}

      const existing = this.readings.find(r => r.group_id === groupId && r.scheduled_date === scheduledDate);
      if (existing) {
        existing.book_number = bookNumber;
        existing.start_chapter = startCh;
        existing.start_verse = startV;
        existing.end_chapter = endCh;
        existing.end_verse = endV;
        existing.excluded_verses = ex;
        return { rows: [{ id: existing.id }], rowCount: 1 };
      }

      const id = crypto.randomUUID();
      this.readings.push({
        id,
        group_id: groupId,
        scheduled_date: scheduledDate,
        book_number: bookNumber,
        start_chapter: startCh,
        start_verse: startV,
        end_chapter: endCh,
        end_verse: endV,
        excluded_verses: ex
      });
      return { rows: [{ id }], rowCount: 1 };
    }

    // 12. Commit questions
    if (t.includes('insert into questions')) {
      const [readingId, type, promptAr, promptEn, optionsJson, correctAns, pts, sortOrder, isApproved] = params;
      const id = crypto.randomUUID();
      let opt = null;
      try { opt = JSON.parse(optionsJson); } catch (e) {}
      this.questions.push({
        id,
        reading_id: readingId,
        type,
        prompt_ar: promptAr,
        prompt_en: promptEn,
        options: opt,
        correct_answer: correctAns,
        points_value: pts,
        sort_order: sortOrder,
        is_approved: isApproved
      });
      return { rows: [{ id }], rowCount: 1 };
    }

    // 13. Servant report
    if (t.includes('from users u') && t.includes('left join daily_readings dr')) {
      const groupId = params[0];
      const scheduledDate = params[1];
      const kids = this.users.filter(u => u.group_id === groupId && u.role === 'kid');
      const reading = this.readings.find(r => r.group_id === groupId && r.scheduled_date === scheduledDate);

      const rows = kids.map(k => {
        const totalQ = reading ? this.questions.filter(q => q.reading_id === reading.id).length : 0;
        const userSubs = reading ? this.submissions.filter(s => s.reading_id === reading.id && s.user_id === k.id) : [];
        const answeredQ = userSubs.length;
        const pts = userSubs.reduce((acc, s) => acc + (s.points_awarded || 0), 0);
        return {
          id: k.id,
          full_name: k.full_name,
          preferred_lang: k.preferred_lang,
          total_points: k.total_points,
          current_streak: k.current_streak,
          reading_id: reading?.id || null,
          total_questions: totalQ,
          questions_answered: answeredQ,
          points_earned_today: pts
        };
      });
      return { rows, rowCount: rows.length };
    }

    // 14. Enrich leaderboard users
    if (t.includes('select id, full_name, preferred_lang, current_streak from users where id = any')) {
      const ids = params[0] || [];
      const found = this.users.filter(u => ids.includes(u.id));
      return { rows: found, rowCount: found.length };
    }

    // 15. Fallback for reading info with group grades
    if (t.includes('from daily_readings dr') && t.includes('join groups g')) {
      const readingId = params[0];
      const r = this.readings.find(rd => rd.id === readingId);
      const g = r ? this.groups.find(grp => grp.id === r.group_id) : this.groups[2];
      const row = {
        ...(r || this.readings[0]),
        min_grade: g?.min_grade || 5,
        max_grade: g?.max_grade || 6
      };
      return { rows: [row], rowCount: 1 };
    }

    // 16. Groups lookup by ID
    if (t.includes('from groups') && t.includes('where id = $1')) {
      const groupId = params[0];
      const g = this.groups.find(grp => grp.id === groupId);
      return {
        rows: g ? [{ min_grade: g.min_grade, max_grade: g.max_grade }] : [{ min_grade: 5, max_grade: 6 }],
        rowCount: 1
      };
    }

    // 17. Delete questions by reading_id
    if (t.includes('delete from questions where reading_id = $1')) {
      const readingId = params[0];
      this.questions = this.questions.filter(q => q.reading_id !== readingId);
      return { rows: [], rowCount: 1 };
    }

    return { rows: [], rowCount: 0 };
  }
}

export const memoryDb = new InMemoryDatabase();
