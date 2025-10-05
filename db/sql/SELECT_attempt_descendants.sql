WITH RECURSIVE 
ta_desc AS (
	SELECT 
		id, 
		parent_id, 
		1 depth,
		'' || id path
	FROM transcription_attempt ta 
	WHERE id IN(:attemptId)
	
	UNION ALL
	
	SELECT 
		ta.id, 
		ta.parent_id, 
		desc.depth + 1 depth,
		desc.path || '/' || ta.id path
	FROM transcription_attempt ta 
	INNER JOIN ta_desc desc
		ON ta.parent_id = desc.id
)
SELECT *
FROM ta_desc