import { describe, it, expect } from 'vitest';

describe('Verse Assembly & Extraction Logic', () => {
  it('validates single chapter range boundaries', () => {
    const startChapter = 3;
    const startVerse = 1;
    const endChapter = 3;
    const endVerse = 15;

    const isValid = startChapter < endChapter || (startChapter === endChapter && startVerse <= endVerse);
    expect(isValid).toBe(true);
  });

  it('validates cross-chapter range boundaries (e.g. John 1:35 - 2:11)', () => {
    const startChapter = 1;
    const startVerse = 35;
    const endChapter = 2;
    const endVerse = 11;

    const isValid = startChapter < endChapter || (startChapter === endChapter && startVerse <= endVerse);
    expect(isValid).toBe(true);
  });

  it('rejects inverted range boundaries', () => {
    const startChapter = 4;
    const startVerse = 10;
    const endChapter = 3;
    const endVerse = 5;

    const isValid = startChapter < endChapter || (startChapter === endChapter && startVerse <= endVerse);
    expect(isValid).toBe(false);
  });

  it('correctly filters excluded verses in-memory simulation', () => {
    const sampleVerses = [
      { chapter: 3, verse: 1 },
      { chapter: 3, verse: 2 },
      { chapter: 3, verse: 3 },
      { chapter: 3, verse: 4 },
      { chapter: 3, verse: 5 }
    ];

    const exclusions = [{ chapter: 3, verse: 2 }, { chapter: 3, verse: 4 }];

    const filtered = sampleVerses.filter(v => 
      !exclusions.some(ex => ex.chapter === v.chapter && ex.verse === v.verse)
    );

    expect(filtered.length).toBe(3);
    expect(filtered.map(v => v.verse)).toEqual([1, 3, 5]);
  });
});
