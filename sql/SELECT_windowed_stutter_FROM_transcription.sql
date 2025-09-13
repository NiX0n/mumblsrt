WITH RECURSIVE
-- Tokenize text into words
split_words(id, word, rest) AS (
    SELECT
        id,
        SUBSTR(text, 1, INSTR(text || ' ', ' ') - 1),
        SUBSTR(text, INSTR(text || ' ', ' ') + 1)
    FROM transcription
    --WHERE 
    --    LENGTH(text) > 0x20
        -- Ignoring this for testing
        --AND attempt_id IN(:attemptId)
    
    UNION ALL

    SELECT
        id,
        SUBSTR(rest, 1, INSTR(rest || ' ', ' ') - 1),
        SUBSTR(rest, INSTR(rest || ' ', ' ') + 1)
    FROM split_words
    WHERE rest <> ''
),

-- Count repeats of each word per row
word_counts AS (
    SELECT
        id,
        word,
        COUNT(*) AS word_count
    FROM split_words
    WHERE word <> ''
    GROUP BY id, word
),

-- Define the window sizes you want to check
window_sizes(size) AS (
    VALUES (1), (2), (3), (5)  -- tune as needed
),

-- For each window size, compute sliding sum of word_count
windowed AS (
    SELECT
        a.id,
        w.size AS window_size,
        b.word,
        SUM(b.word_count) AS word_count_sum
        --AVG(b.mean_word_count) AS window_avg
    FROM word_counts a
    CROSS JOIN window_sizes w
    JOIN word_counts b
        ON b.id BETWEEN a.id - (w.size - 1) AND a.id + (w.size - 1)
        AND a.word = b.word
    GROUP BY a.id, w.size, b.word
),

-- Mean word count per row (your original logic)
aggregated AS (
    SELECT
        id,
        window_size,
        AVG(word_count_sum) AS mean_word_count
    FROM windowed
    GROUP BY id, window_size
    HAVING mean_word_count > 2
)
--SELECT * FROM aggregated a JOIN transcription t ON a.id = t.id
,

-- Flag rows that exceed threshold in ANY window size
flagged AS (
    SELECT DISTINCT id
    FROM aggregated
    WHERE mean_word_count > 2  -- threshold: tune as needed
),

-- Add lag to detect contiguous ranges
lagged AS (
    SELECT
        f.id,
        LAG(f.id) OVER (ORDER BY f.id) AS prev_id
    FROM flagged f
),

-- Group contiguous flagged rows into ranges
grouped AS (
    SELECT
        id,
        SUM(CASE
            WHEN prev_id IS NULL OR id <> prev_id + 1
            THEN 1 ELSE 0
        END) OVER (ORDER BY id) AS group_id
    FROM lagged
)

-- Join back to transcription to get full range info
SELECT 
    t.attempt_id,
    g.group_id,
    MIN(g.id) AS min_id,
    MAX(g.id) AS max_id,
    MIN(t.from_offset) AS min_from_offset,
    MAX(t.to_offset) AS max_to_offset,
    COUNT(*) AS row_count,
    GROUP_CONCAT(t.text, ' || ') AS text

FROM grouped g
JOIN transcription t ON g.id = t.id
GROUP BY t.attempt_id, g.group_id
HAVING max_to_offset - min_from_offset > 0
ORDER BY min_id