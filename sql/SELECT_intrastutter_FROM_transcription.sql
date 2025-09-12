WITH RECURSIVE
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
word_counts AS (
    SELECT
        id,
        word,
        COUNT(*) AS word_count
    FROM split_words
    WHERE word <> ''
    GROUP BY id, word
),
aggregated AS (
	SELECT
	    id,
	    AVG(word_count) AS mean_word_count
	
	FROM word_counts c
	GROUP BY id
	HAVING mean_word_count > 2
),
lagged AS (
    SELECT
        *,
        LAG(id) OVER (ORDER BY id) AS prev_id
    FROM aggregated
),
grouped AS (
	SELECT
		*,
		-- start a new group whenever id <> prev_id+1 (or on the very first row)
		SUM(CASE 
			WHEN 
				prev_id IS NULL 
				OR id <> prev_id + 1
			THEN 1 
			ELSE 0 
		END) OVER (ORDER BY id) AS group_id
	FROM lagged
)
SELECT 
	t.attempt_id,
	g.group_id,
    MIN(g.id) AS min_id,
    MAX(g.id) AS max_id,
    MIN(from_offset) AS min_from_offset,
    MAX(to_offset) AS max_to_offset,
    COUNT(*) AS count,
    text

FROM grouped g
INNER JOIN transcription t 
	ON g.id  = t.id 
GROUP BY group_id
HAVING max_to_offset - min_from_offset > 0
;