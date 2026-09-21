import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../db/pool.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

export interface CanonicalBook {
  num: number;
  code: string;
  nameEn: string;
  nameAr: string;
}

export const CANONICAL_BOOKS: CanonicalBook[] = [
  { num: 1, code: 'GEN', nameEn: 'Genesis', nameAr: 'التكوين' },
  { num: 2, code: 'EXO', nameEn: 'Exodus', nameAr: 'الخروج' },
  { num: 3, code: 'LEV', nameEn: 'Leviticus', nameAr: 'اللاويين' },
  { num: 4, code: 'NUM', nameEn: 'Numbers', nameAr: 'العدد' },
  { num: 5, code: 'DEU', nameEn: 'Deuteronomy', nameAr: 'التثنية' },
  { num: 6, code: 'JOS', nameEn: 'Joshua', nameAr: 'يشوع' },
  { num: 7, code: 'JDG', nameEn: 'Judges', nameAr: 'القضاة' },
  { num: 8, code: 'RUT', nameEn: 'Ruth', nameAr: 'راعوث' },
  { num: 9, code: '1SA', nameEn: '1 Samuel', nameAr: 'صموئيل الأول' },
  { num: 10, code: '2SA', nameEn: '2 Samuel', nameAr: 'صموئيل الثاني' },
  { num: 11, code: '1KI', nameEn: '1 Kings', nameAr: 'الملوك الأول' },
  { num: 12, code: '2KI', nameEn: '2 Kings', nameAr: 'الملوك الثاني' },
  { num: 13, code: '1CH', nameEn: '1 Chronicles', nameAr: 'أخبار الأيام الأول' },
  { num: 14, code: '2CH', nameEn: '2 Chronicles', nameAr: 'أخبار الأيام الثاني' },
  { num: 15, code: 'EZR', nameEn: 'Ezra', nameAr: 'عزرا' },
  { num: 16, code: 'NEH', nameEn: 'Nehemiah', nameAr: 'نحميا' },
  { num: 17, code: 'EST', nameEn: 'Esther', nameAr: 'أستير' },
  { num: 18, code: 'JOB', nameEn: 'Job', nameAr: 'أيوب' },
  { num: 19, code: 'PSA', nameEn: 'Psalms', nameAr: 'المزامير' },
  { num: 20, code: 'PRO', nameEn: 'Proverbs', nameAr: 'الأمثال' },
  { num: 21, code: 'ECC', nameEn: 'Ecclesiastes', nameAr: 'الجامعة' },
  { num: 22, code: 'SNG', nameEn: 'Song of Solomon', nameAr: 'نشيد الأنشاد' },
  { num: 23, code: 'ISA', nameEn: 'Isaiah', nameAr: 'إشعياء' },
  { num: 24, code: 'JER', nameEn: 'Jeremiah', nameAr: 'إرميا' },
  { num: 25, code: 'LAM', nameEn: 'Lamentations', nameAr: 'مراثي إرميا' },
  { num: 26, code: 'EZK', nameEn: 'Ezekiel', nameAr: 'حزقيال' },
  { num: 27, code: 'DAN', nameEn: 'Daniel', nameAr: 'دانيال' },
  { num: 28, code: 'HOS', nameEn: 'Hosea', nameAr: 'هوشع' },
  { num: 29, code: 'JOL', nameEn: 'Joel', nameAr: 'يوئيل' },
  { num: 30, code: 'AMO', nameEn: 'Amos', nameAr: 'عاموس' },
  { num: 31, code: 'OBA', nameEn: 'Obadiah', nameAr: 'عوبديا' },
  { num: 32, code: 'JON', nameEn: 'Jonah', nameAr: 'يونان' },
  { num: 33, code: 'MIC', nameEn: 'Micah', nameAr: 'ميخا' },
  { num: 34, code: 'NAM', nameEn: 'Nahum', nameAr: 'ناحوم' },
  { num: 35, code: 'HAB', nameEn: 'Habakkuk', nameAr: 'حبقوق' },
  { num: 36, code: 'ZEP', nameEn: 'Zephaniah', nameAr: 'صفنيا' },
  { num: 37, code: 'HAG', nameEn: 'Haggai', nameAr: 'حجي' },
  { num: 38, code: 'ZEC', nameEn: 'Zechariah', nameAr: 'زكريا' },
  { num: 39, code: 'MAL', nameEn: 'Malachi', nameAr: 'ملاخي' },
  { num: 40, code: 'MAT', nameEn: 'Matthew', nameAr: 'متى' },
  { num: 41, code: 'MRK', nameEn: 'Mark', nameAr: 'مرقس' },
  { num: 42, code: 'LUK', nameEn: 'Luke', nameAr: 'لوقا' },
  { num: 43, code: 'JHN', nameEn: 'John', nameAr: 'يوحنا' },
  { num: 44, code: 'ACT', nameEn: 'Acts', nameAr: 'أعمال الرسل' },
  { num: 45, code: 'ROM', nameEn: 'Romans', nameAr: 'رومية' },
  { num: 46, code: '1CO', nameEn: '1 Corinthians', nameAr: 'كورنثوس الأولى' },
  { num: 47, code: '2CO', nameEn: '2 Corinthians', nameAr: 'كورنثوس الثانية' },
  { num: 48, code: 'GAL', nameEn: 'Galatians', nameAr: 'غلاطية' },
  { num: 49, code: 'EPH', nameEn: 'Ephesians', nameAr: 'أفسس' },
  { num: 50, code: 'PHP', nameEn: 'Philippians', nameAr: 'فيلبي' },
  { num: 51, code: 'COL', nameEn: 'Colossians', nameAr: 'كولوسي' },
  { num: 52, code: '1TH', nameEn: '1 Thessalonians', nameAr: 'تسالونيكي الأولى' },
  { num: 53, code: '2TH', nameEn: '2 Thessalonians', nameAr: 'تسالونيكي الثانية' },
  { num: 54, code: '1TI', nameEn: '1 Timothy', nameAr: 'تيموثاوس الأولى' },
  { num: 55, code: '2TI', nameEn: '2 Timothy', nameAr: 'تيموثاوس الثانية' },
  { num: 56, code: 'TIT', nameEn: 'Titus', nameAr: 'تيطس' },
  { num: 57, code: 'PHM', nameEn: 'Philemon', nameAr: 'فليمون' },
  { num: 58, code: 'HEB', nameEn: 'Hebrews', nameAr: 'العبرانيين' },
  { num: 59, code: 'JAS', nameEn: 'James', nameAr: 'يعقوب' },
  { num: 60, code: '1PE', nameEn: '1 Peter', nameAr: 'بطرس الأولى' },
  { num: 61, code: '2PE', nameEn: '2 Peter', nameAr: 'بطرس الثانية' },
  { num: 62, code: '1JN', nameEn: '1 John', nameAr: 'يوحنا الأولى' },
  { num: 63, code: '2JN', nameEn: '2 John', nameAr: 'يوحنا الثانية' },
  { num: 64, code: '3JN', nameEn: '3 John', nameAr: 'يوحنا الثالثة' },
  { num: 65, code: 'JUD', nameEn: 'Jude', nameAr: 'يهوذا' },
  { num: 66, code: 'REV', nameEn: 'Revelation', nameAr: 'الرؤيا' }
];

export function stripArabicDiacritics(text: string): string {
  return text
    .replace(/[\u064B-\u065F\u0670]/g, '') // Tashkeel / Harakat
    .replace(/\u0640/g, '') // Tatweel
    .replace(/[ٱإأآ]/g, 'ا') // Normalize alef
    .replace(/ة/g, 'ه') // Normalize teh marbuta
    .replace(/ى/g, 'ي') // Normalize alef maksura
    .trim();
}

export interface IngestedVerse {
  book_number: number;
  book_name_en: string;
  book_name_ar: string;
  chapter: number;
  verse: number;
  text_en: string;
  text_ar: string;
  text_ar_clean: string;
}

export function parseKjvBible(kjvFilePath: string): Map<number, Map<number, Map<number, string>>> {
  console.log(`📖 Parsing English Bible: ${kjvFilePath}`);
  const content = fs.readFileSync(kjvFilePath, 'utf-8');
  const lines = content.split(/\r?\n/);

  const parsed = new Map<number, Map<number, Map<number, string>>>();
  let currentBookIdx = -1;
  let currentChapter = 0;
  let currentVerse = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Check next book name
    if (currentBookIdx + 1 < CANONICAL_BOOKS.length && line === CANONICAL_BOOKS[currentBookIdx + 1].nameEn) {
      currentBookIdx++;
      const currentBook = CANONICAL_BOOKS[currentBookIdx];
      // Single chapter books start directly at chapter 1
      currentChapter = ['Obadiah', 'Philemon', '2 John', '3 John', 'Jude'].includes(currentBook.nameEn) ? 1 : 0;
      parsed.set(currentBook.num, new Map());
      if (currentChapter === 1) {
        parsed.get(currentBook.num)!.set(1, new Map());
      }
      continue;
    }

    // Check chapter header
    const chMatch = line.match(/^(?:Chapter|Psalm)\s+(\d+)/i);
    if (chMatch && currentBookIdx >= 0) {
      currentChapter = parseInt(chMatch[1], 10);
      const bNum = CANONICAL_BOOKS[currentBookIdx].num;
      if (!parsed.has(bNum)) parsed.set(bNum, new Map());
      parsed.get(bNum)!.set(currentChapter, new Map());
      continue;
    }

    // Check verse start (e.g. '1 In the beginning...', '1 ¶ In the beginning...')
    const vMatch = line.match(/^(\d+)\s+(?:¶\s+)?(.*)/);
    if (vMatch && currentBookIdx >= 0 && currentChapter > 0) {
      currentVerse = parseInt(vMatch[1], 10);
      const bNum = CANONICAL_BOOKS[currentBookIdx].num;
      parsed.get(bNum)!.get(currentChapter)!.set(currentVerse, vMatch[2]);
    } else if (currentBookIdx >= 0 && currentChapter > 0 && currentVerse > 0) {
      // Continuation of multi-line verse
      const bNum = CANONICAL_BOOKS[currentBookIdx].num;
      const existing = parsed.get(bNum)!.get(currentChapter)!.get(currentVerse) || '';
      parsed.get(bNum)!.get(currentChapter)!.set(currentVerse, existing + ' ' + line);
    }
  }

  return parsed;
}

export function parseArabicBible(arabicDirPath: string): Map<number, Map<number, Map<number, string>>> {
  console.log(`📖 Parsing Arabic Smith & Van Dyck Bible: ${arabicDirPath}`);
  const codeMap = new Map<string, CanonicalBook>();
  CANONICAL_BOOKS.forEach(b => codeMap.set(b.code, b));

  const parsed = new Map<number, Map<number, Map<number, string>>>();
  const files = fs.readdirSync(arabicDirPath);

  for (const file of files) {
    const m = file.match(/arb-vd_\d+_([A-Z0-9]+)_(\d+)_read\.txt/);
    if (!m) continue;

    const book = codeMap.get(m[1]);
    if (!book) continue;

    const chapter = parseInt(m[2], 10);
    const content = fs.readFileSync(path.join(arabicDirPath, file), 'utf-8');
    const lines = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    // Line 0 is Book Title, Line 1 is Chapter Number, Lines 2+ are verses (1-indexed)
    const verseLines = lines.slice(2);

    if (!parsed.has(book.num)) parsed.set(book.num, new Map());
    if (!parsed.get(book.num)!.has(chapter)) parsed.get(book.num)!.set(chapter, new Map());

    const chapterMap = parsed.get(book.num)!.get(chapter)!;
    for (let v = 0; v < verseLines.length; v++) {
      chapterMap.set(v + 1, verseLines[v]);
    }
  }

  return parsed;
}

export function compileBilingualBible(
  kjvMap: Map<number, Map<number, Map<number, string>>>,
  arbMap: Map<number, Map<number, Map<number, string>>>
): IngestedVerse[] {
  console.log('🔄 Compiling bilingual Bible verses side-by-side...');
  const compiled: IngestedVerse[] = [];

  for (const book of CANONICAL_BOOKS) {
    const kjvChapters = kjvMap.get(book.num) || new Map();
    const arbChapters = arbMap.get(book.num) || new Map();

    const allChapters = new Set([...kjvChapters.keys(), ...arbChapters.keys()]);
    const sortedChapters = Array.from(allChapters).sort((a, b) => a - b);

    for (const chapter of sortedChapters) {
      const kjvVerses = kjvChapters.get(chapter) || new Map();
      const arbVerses = arbChapters.get(chapter) || new Map();

      const allVerses = new Set([...kjvVerses.keys(), ...arbVerses.keys()]);
      const sortedVerses = Array.from(allVerses).sort((a, b) => a - b);

      for (const verse of sortedVerses) {
        const textEn = kjvVerses.get(verse) || '';
        const textAr = arbVerses.get(verse) || '';
        const textArClean = stripArabicDiacritics(textAr);

        if (textEn || textAr) {
          compiled.push({
            book_number: book.num,
            book_name_en: book.nameEn,
            book_name_ar: book.nameAr,
            chapter,
            verse,
            text_en: textEn || '[Missing English]',
            text_ar: textAr || '[Missing Arabic]',
            text_ar_clean: textArClean || '[Missing Arabic]'
          });
        }
      }
    }
  }

  return compiled;
}

export async function importToPostgres(verses: IngestedVerse[]) {
  console.log(`💾 Inserting ${verses.length} verses into PostgreSQL bible_verses...`);
  const batchSize = 500;
  let inserted = 0;

  for (let i = 0; i < verses.length; i += batchSize) {
    const chunk = verses.slice(i, i + batchSize);
    
    // Construct parameterized multi-row insert
    const valuePlaceholders: string[] = [];
    const params: any[] = [];
    let pIdx = 1;

    for (const v of chunk) {
      valuePlaceholders.push(
        `($${pIdx}, $${pIdx + 1}, $${pIdx + 2}, $${pIdx + 3}, $${pIdx + 4}, $${pIdx + 5}, $${pIdx + 6}, $${pIdx + 7})`
      );
      params.push(
        v.book_number,
        v.book_name_en,
        v.book_name_ar,
        v.chapter,
        v.verse,
        v.text_en,
        v.text_ar,
        v.text_ar_clean
      );
      pIdx += 8;
    }

    const sql = `
      INSERT INTO bible_verses (
        book_number, book_name_en, book_name_ar,
        chapter, verse, text_en_nkjv, text_ar_vandyk, text_ar_clean
      )
      VALUES ${valuePlaceholders.join(', ')}
      ON CONFLICT (book_number, chapter, verse)
      DO UPDATE SET
        book_name_en = EXCLUDED.book_name_en,
        book_name_ar = EXCLUDED.book_name_ar,
        text_en_nkjv = EXCLUDED.text_en_nkjv,
        text_ar_vandyk = EXCLUDED.text_ar_vandyk,
        text_ar_clean = EXCLUDED.text_ar_clean;
    `;

    await pool.query(sql, params);
    inserted += chunk.length;
    if (inserted % 5000 === 0 || inserted === verses.length) {
      console.log(`   ✅ Ingested ${inserted} / ${verses.length} verses...`);
    }
  }
}

export async function main() {
  const kjvPath = path.join(rootDir, 'kjv.txt');
  const arbDir = path.join(rootDir, 'arb-vd_readaloud');

  if (!fs.existsSync(kjvPath)) {
    console.error(`❌ English KJV file not found at: ${kjvPath}`);
    process.exit(1);
  }
  if (!fs.existsSync(arbDir)) {
    console.error(`❌ Arabic Bible directory not found at: ${arbDir}`);
    process.exit(1);
  }

  const start = Date.now();
  const kjvMap = parseKjvBible(kjvPath);
  const arbMap = parseArabicBible(arbDir);
  const compiledVerses = compileBilingualBible(kjvMap, arbMap);

  console.log(`✨ Successfully compiled ${compiledVerses.length} bilingual verses across 66 books!`);

  // Write compact JSON cache for ultra-fast in-memory and local development
  const jsonPath = path.join(rootDir, 'src/db/bible_data.json');
  console.log(`📦 Writing compiled dataset to: ${jsonPath}`);
  fs.writeFileSync(jsonPath, JSON.stringify(compiledVerses));
  console.log(`   File written (${(fs.statSync(jsonPath).size / 1024 / 1024).toFixed(2)} MB)`);

  // Attempt database insertion if PostgreSQL is reachable
  try {
    await importToPostgres(compiledVerses);
    console.log('🎉 Full Bible ingestion into PostgreSQL completed successfully!');
  } catch (err: any) {
    if (err.code === 'ECONNREFUSED' || err.message?.includes('connect ECONNREFUSED')) {
      console.warn('⚠️ PostgreSQL is currently offline at localhost:5432.');
      console.warn('   The compiled Bible dataset was saved to src/db/bible_data.json and will be used by the in-memory engine.');
      console.warn('   To load into PostgreSQL once started, simply re-run: npm run import-bible');
    } else {
      console.error('Error inserting into PostgreSQL:', err);
    }
  } finally {
    await pool.end();
  }

  console.log(`⏱️ Finished in ${((Date.now() - start) / 1000).toFixed(2)}s`);
}

if (process.argv[1] && process.argv[1].endsWith('import_bible.ts')) {
  main().catch(console.error);
}
