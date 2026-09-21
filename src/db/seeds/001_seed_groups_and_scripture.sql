-- Seed data for Evangelion Platform

-- 1. Insert 7 Core Sunday School Groups
INSERT INTO groups (id, name, gender, min_grade, max_grade) VALUES
(1, 'Grade 3 & 4 Boys', 'boys', 3, 4),
(2, 'Grade 3 & 4 Girls', 'girls', 3, 4),
(3, 'Grade 5 & 6 Boys', 'boys', 5, 6),
(4, 'Grade 5 & 6 Girls', 'girls', 5, 6),
(5, 'Grade 6, 7 & 8 Boys', 'boys', 6, 8),
(6, 'Grade 6, 7 & 8 Girls', 'girls', 6, 8),
(7, 'Grade 10, 11 & 12 Mixed', 'mixed', 10, 12)
ON CONFLICT (id) DO NOTHING;

-- Reset sequence if needed
SELECT setval('groups_id_seq', (SELECT MAX(id) FROM groups));

-- 2. Insert Sample Servants and Kids for Testing
INSERT INTO users (id, group_id, full_name, username, role, preferred_lang, total_points, current_streak) VALUES
('11111111-1111-1111-1111-111111111111', 3, 'David Mina (Grade 5)', 'david_mina', 'kid', 'ar', 50, 4),
('22222222-2222-2222-2222-222222222222', 3, 'Peter George (Grade 6)', 'peter_george', 'kid', 'ar', 80, 7),
('33333333-3333-3333-3333-333333333333', 3, 'Mark Anton (Grade 5)', 'mark_anton', 'kid', 'en', 30, 2),
('99999999-9999-9999-9999-999999999999', NULL, 'Servant Michael', 'servant_michael', 'admin_servant', 'ar', 0, 0)
ON CONFLICT (id) DO NOTHING;

-- 3. Canonical Scripture Verses (Book 43: John / يوحنا)
-- John 1:35-37 (Cross-chapter demo part 1)
INSERT INTO bible_verses (book_number, book_name_en, book_name_ar, chapter, verse, text_en_nkjv, text_ar_vandyk, text_ar_clean) VALUES
(43, 'John', 'يوحنا', 1, 35, 
 'Again, the next day, John stood with two of his disciples.', 
 'وَفِي الْغَدِ أَيْضاً كَانَ يُوحَنَّا وَاقِفاً هُوَ وَاثْنَانِ مِنْ تَلَامِيذِهِ،', 
 'وفي الغد ايضا كان يوحنا واقفا هو واثنان من تلاميذه،'),

(43, 'John', 'يوحنا', 1, 36, 
 'And looking at Jesus as He walked, he said, "Behold the Lamb of God!"', 
 'فَنَظَرَ إِلَى يَسُوعَ مَاشِياً، فَقَالَ: «هُوَذَا حَمَلُ اللهِ!».', 
 'فنظر الى يسوع ماشيا، فقال: «هوذا حمل الله!».'),

(43, 'John', 'يوحنا', 1, 37, 
 'The two disciples heard him speak, and they followed Jesus.', 
 'فَسَمِعَهُ التِّلْمِيذَانِ يَتَكَلَّمُ، فَتَبِعَا يَسُوعَ.', 
 'فسمعه التلميذان يتكلم، فتبعا يسوع.'),

-- John 2:1-2 (Cross-chapter demo part 2)
(43, 'John', 'يوحنا', 2, 1, 
 'On the third day there was a wedding in Cana of Galilee, and the mother of Jesus was there.', 
 'وَفِي الْيَوْمِ الثَّالِثِ كَانَ عُرْسٌ فِي قَانَا الْجَلِيلِ، وَكَانَتْ أُمُّ يَسُوعَ هُنَاكَ.', 
 'وفي اليوم الثالث كان عرس في قانا الجليل، وكانت ام يسوع هناك.'),

(43, 'John', 'يوحنا', 2, 2, 
 'Now both Jesus and His disciples were invited to the wedding.', 
 'وَدُعِيَ أَيْضاً يَسُوعُ وَتَلَامِيذُهُ إِلَى الْعُرْسِ.', 
 'ودعي ايضا يسوع وتلاميذه الى العرس.'),

-- John 3:1-5 (Nicodemus passage)
(43, 'John', 'يوحنا', 3, 1, 
 'There was a man of the Pharisees named Nicodemus, a ruler of the Jews.', 
 'كَانَ إِنْسَانٌ مِنَ الْفَرِّيسِيِّينَ اسْمُهُ نِيقُودِيمُوسُ، رَئِيسٌ لِلْيَهُودِ.', 
 'كان انسان من الفريسيين اسمه نيقوديموس، رئيس لليهود.'),

(43, 'John', 'يوحنا', 3, 2, 
 'This man came to Jesus by night and said to Him, "Rabbi, we know that You are a teacher come from God; for no one can do these signs that You do unless God is with him."', 
 'هَذَا جَاءَ إِلَى يَسُوعَ لَيْلاً وَقَالَ لَهُ: «يَا مُعَلِّمُ، نَعْلَمُ أَنَّكَ قَدْ أَتَيْتَ مِنَ اللهِ مُعَلِّماً، لأَنَّهُ لَيْسَ أَحَدٌ يَقْدِرُ أَنْ يَعْمَلَ هَذِهِ الآيَاتِ الَّتِي أَنْتَ تَعْمَلُ إِنْ لَمْ يَكُنِ اللهُ مَعَهُ».', 
 'هذا جاء الى يسوع ليلا وقال له: «يا معلم، نعلم انك قد اتيت من الله معلما، لانه ليس احد يقدر ان يعمل هذه الايات التي انت تعمل ان لم يكن الله معه».'),

(43, 'John', 'يوحنا', 3, 3, 
 'Jesus answered and said to him, "Most assuredly, I say to you, unless one is born again, he cannot see the kingdom of God."', 
 'أَجَابَ يَسُوعُ وَقَالَ لَهُ: «الْحَقَّ الْحَقَّ أَقُولُ لَكَ: إِنْ كَانَ أَحَدٌ لاَ يُولَدُ مِنْ فَوْقُ لاَ يَقْدِرُ أَنْ يَرَى مَلَكُوتَ اللهِ».', 
 'اجاب يسوع وقال له: «الحق الحق اقول لك: ان كان احد لا يولد من فوق لا يقدر ان يرى ملكوت الله».'),

(43, 'John', 'يوحنا', 3, 4, 
 'Nicodemus said to Him, "How can a man be born when he is old? Can he enter a second time into his mother''s womb and be born?"', 
 'قَالَ لَهُ نِيقُودِيمُوسُ: «كَيْفَ يُمْكِنُ الإِنْسَانَ أَنْ يُولَدَ وَهُوَ شَيْخٌ؟ أَلَعَلَّهُ يَقْدِرُ أَنْ يَدْخُلَ بَطْنَ أُمِّهِ ثَانِيَةً وَيُولَدَ؟».', 
 'قال له نيقوديموس: «كيف يمكن الانسان ان يولد وهو شيخ؟ العله يقدر ان يدخل بطن امه ثانية ويولد؟».'),

(43, 'John', 'يوحنا', 3, 5, 
 'Jesus answered, "Most assuredly, I say to you, unless one is born of water and the Spirit, he cannot enter the kingdom of God."', 
 'أَجَابَ يَسُوعُ: «الْحَقَّ الْحَقَّ أَقُولُ لَكَ: إِنْ كَانَ أَحَدٌ لاَ يُولَدُ مِنَ الْمَاءِ وَالرُّوحِ لاَ يَقْدِرُ أَنْ يَدْخُلَ مَلَكُوتَ اللهِ».', 
 'اجاب يسوع: «الحق الحق اقول لك: ان كان احد لا يولد من الماء والروح لا يقدر ان يدخل ملكوت الله».')
ON CONFLICT (book_number, chapter, verse) DO NOTHING;

-- 4. Sample Daily Reading Scheduled for Today (Group 3: Grade 5 & 6 Boys)
INSERT INTO daily_readings (id, group_id, scheduled_date, book_number, start_chapter, start_verse, end_chapter, end_verse, excluded_verses, created_by)
VALUES (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    3,
    CURRENT_DATE,
    43,
    3, 1, 3, 5,
    '[]'::jsonb,
    '99999999-9999-9999-9999-999999999999'
)
ON CONFLICT (group_id, scheduled_date) DO NOTHING;

-- 5. Sample Question for Today's Reading
INSERT INTO questions (id, reading_id, type, prompt_ar, prompt_en, options, correct_answer, points_value, sort_order)
VALUES (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'mcq',
    'مَا اسْمُ الرَّجُلِ الْفَرِّيسِيِّ الَّذِي جَاءَ إِلَى يَسُوعَ لَيْلاً؟',
    'What was the name of the Pharisee who came to Jesus by night?',
    '{
        "A": {"ar": "نِيقُودِيمُوسُ", "en": "Nicodemus"},
        "B": {"ar": "بُولُسُ", "en": "Paul"},
        "C": {"ar": "بُطْرُسُ", "en": "Peter"},
        "D": {"ar": "لِعَازَرُ", "en": "Lazarus"}
    }'::jsonb,
    'A',
    10,
    1
)
ON CONFLICT (id) DO NOTHING;
