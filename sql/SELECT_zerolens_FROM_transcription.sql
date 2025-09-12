WITH zeros AS (
	SELECT 
		id,
		attempt_id,
		from_offset AS offset
	FROM transcription t 
	WHERE 
		is_active <> 0
		AND to_offset - from_offset = 0
		AND attempt_id IN(:attemptId)
)
SELECT 
	t.attempt_id,
	z.id group_id,
    MIN(t.id) AS min_id,
    MAX(t.id) AS max_id,
    MIN(from_offset) AS min_from_offset,
    MAX(to_offset) AS max_to_offset,
    COUNT(*) AS count,
    text

FROM transcription t 
INNER JOIN zeros z
	ON t.attempt_id = z.attempt_id 
	AND (
		t.from_offset BETWEEN z.offset - 60000 AND z.offset + 60000
		OR t.to_offset BETWEEN z.offset - 60000 AND z.offset + 60000
	)
GROUP BY z.id, t.attempt_id 


