WITH RECURSIVE
-- 1. Tokenize text into words
split_words(id, word, rest) AS (
    SELECT
        id,
        SUBSTR(text, 1, INSTR(text || ' ', ' ') - 1),
        SUBSTR(text, INSTR(text || ' ', ' ') + 1)
    FROM transcription
    WHERE 
        LENGTH(text) > 0x20
        AND attempt_id IN(:attemptId)
    
    UNION ALL

    SELECT
        id,
        SUBSTR(rest, 1, INSTR(rest || ' ', ' ') - 1),
        SUBSTR(rest, INSTR(rest || ' ', ' ') + 1)
    FROM split_words
    WHERE rest <> ''
),

-- 2. Count repeats of each word per row
word_counts AS (
    SELECT
        id,
        word,
        COUNT(*) AS word_count
    FROM split_words
    WHERE word <> ''
    GROUP BY id, word
),

-- 3. Mean word count per row (your original logic)
aggregated AS (
    SELECT
        id,
        AVG(word_count) AS mean_word_count
    FROM word_counts
    GROUP BY id
),

-- 4. Define the window sizes you want to check
window_sizes(size) AS (
    VALUES (1), (2), (3), (5)  -- tune as needed
),

-- 5. For each window size, compute sliding mean of mean_word_count
windowed AS (
    SELECT
        a.id,
        w.size,
        AVG(a.mean_word_count) OVER (
            ORDER BY a.id
            ROWS BETWEEN w.size - 1 PRECEDING AND w.size - 1 FOLLOWING
        ) AS window_avg
    FROM aggregated a
    CROSS JOIN window_sizes w
),

-- 6. Flag rows that exceed threshold in ANY window size
flagged AS (
    SELECT DISTINCT id
    FROM windowed
    WHERE window_avg > 2  -- threshold: tune as needed
),

-- 7. Add lag to detect contiguous ranges
lagged AS (
    SELECT
        f.id,
        LAG(f.id) OVER (ORDER BY f.id) AS prev_id
    FROM flagged f
),

-- 8. Group contiguous flagged rows into ranges
grouped AS (
    SELECT
        id,
        SUM(CASE
            WHEN prev_id IS NULL OR id <> prev_id + 1
            THEN 1 ELSE 0
        END) OVER (ORDER BY id) AS group_id
    FROM lagged
)

-- 9. Join back to transcription to get full range info
SELECT 
    t.attempt_id,
    g.group_id,
    MIN(g.id) AS min_id,
    MAX(g.id) AS max_id,
    MIN(t.from_offset) AS min_from_offset,
    MAX(t.to_offset) AS max_to_offset,
    COUNT(*) AS row_count,
    GROUP_CONCAT(t.text, ' || ') AS combined_text
FROM grouped g
JOIN transcription t ON g.id = t.id
GROUP BY t.attempt_id, g.group_id
HAVING max_to_offset - min_from_offset > 0
ORDER BY min_id
;
