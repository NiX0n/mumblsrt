WITH
suspects AS (
    SELECT
        id
    FROM transcription
    WHERE 
        is_suspect <> 0
        AND attempt_id IN(:attemptId)

),
lagged AS (
    SELECT
        *,
        LAG(id) OVER (ORDER BY id) AS prev_id
    FROM suspects
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