WITH RECURSIVE
-- Tokenize text into words (consider normalizing)
split_words(id, attempt_id, word, rest) AS (
    SELECT
        id,
        attempt_id,
        -- Find strings delimited by space
        -- Normalize w/ LOWER() insofar as accurate counts of caseless words and symbols
        LOWER(SUBSTR(text, 1, INSTR(text || ' ', ' ') - 1)) AS word,
        LOWER(SUBSTR(text, INSTR(text || ' ', ' ') + 1))     AS rest
    FROM transcription
    WHERE 
        -- Ignoring this for testing
        attempt_id IN(:attemptId)
        --attempt_id <> 1
        --LENGTH(text) > 0x20

    
    UNION ALL
    
    SELECT
        id,
        attempt_id,
        SUBSTR(rest, 1, INSTR(rest || ' ', ' ') - 1),
        SUBSTR(rest, INSTR(rest || ' ', ' ') + 1)
    FROM split_words
    WHERE rest <> ''
),

-- Normalize words (lowercase, strip simple punctuation). Extend as needed.
-- We aren't normalizing like this because odd symbols can stutter too, and should be considered
-- norm_words AS (
--     SELECT
--         id,
--         attempt_id,
--         LOWER(
--           REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(raw_word,
--             '.', ''), ',', ''), '!', ''), '?', ''), ';', ''), ':', '')
--         ) AS word
--     FROM split_words
--     WHERE raw_word <> ''
-- ),

-- Count repeats of each word per row
word_counts AS (
    SELECT
        id,
        attempt_id,
        word,
        COUNT(*) AS word_count
    FROM split_words
    WHERE word <> ''
    GROUP BY id, attempt_id, word
),

-- Window sizes to test
window_sizes(size) AS (
    VALUES (1), (2), (3), (5)
),

-- Centers and fixed window bounds (do NOT vary per word)
centers AS (
    SELECT DISTINCT
        wc.id,
        wc.attempt_id
    FROM word_counts wc
),

bounds AS (
    SELECT
        c.attempt_id,
        c.id AS center_id,
        w.size AS window_size,
        c.id - (w.size - 1) AS min_id,
        c.id + (w.size - 1) AS max_id
    FROM centers c
    CROSS JOIN window_sizes w
),

-- Sum counts per distinct word within each fixed window
window_vocab AS (
    SELECT
        b.attempt_id,
        b.center_id AS id,
        b.window_size,
        b.min_id,
        b.max_id,
        wc.word,
        SUM(wc.word_count) AS word_count_sum
    FROM bounds b
    JOIN word_counts wc
      ON wc.attempt_id = b.attempt_id
     AND wc.id BETWEEN b.min_id AND b.max_id
    GROUP BY b.attempt_id, b.center_id, b.window_size, b.min_id, b.max_id, wc.word
),

-- Optional: filter out very common stopwords to reduce noise
-- stopworded AS (
--   SELECT * FROM window_vocab
--   WHERE word NOT IN ('the','to','a','of','and','in','is','it','for','on','that','with','as')
-- ),

--  Average across all distinct words in the fixed window
aggregated AS (
    SELECT
        attempt_id,
        id,
        window_size,
        min_id,
        max_id,
        AVG(word_count_sum) AS mean_word_count,
        COUNT(*)            AS distinct_words_in_window,
        SUM(word_count_sum) AS total_counts_in_window
    FROM window_vocab
    -- FROM stopworded
    GROUP BY attempt_id, id, window_size, min_id, max_id
    HAVING mean_word_count > 2
),

-- Flag all rows within the suspect windows
flagged AS (
    SELECT DISTINCT
        a.attempt_id,
        t.id
    FROM aggregated a
    JOIN transcription t
      ON t.attempt_id = a.attempt_id
     AND t.id BETWEEN a.min_id AND a.max_id
),

-- Group contiguous flagged rows per attempt
lagged AS (
    SELECT
        attempt_id,
        id,
        LAG(id) OVER (PARTITION BY attempt_id ORDER BY id) AS prev_id
    FROM flagged
),
grouped AS (
    SELECT
        attempt_id,
        id,
        SUM(CASE WHEN prev_id IS NULL OR id <> prev_id + 1 THEN 1 ELSE 0 END)
            OVER (PARTITION BY attempt_id ORDER BY id) AS group_id
    FROM lagged
)

-- Return full ranges
SELECT
    t.attempt_id,
    g.group_id,
    MIN(g.id) AS min_id,
    MAX(g.id) AS max_id,
    MIN(t.from_offset) AS min_from_offset,
    MAX(t.to_offset)   AS max_to_offset,
    COUNT(*) AS row_count,
    GROUP_CONCAT(t.text, ' || ') AS text
FROM grouped g
JOIN transcription t
  ON t.attempt_id = g.attempt_id
 AND t.id = g.id
GROUP BY t.attempt_id, g.group_id
HAVING max_to_offset - min_from_offset > 0
ORDER BY min_id