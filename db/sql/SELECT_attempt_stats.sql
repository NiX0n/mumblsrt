WITH RECURSIVE 
ta_desc AS (
	SELECT 
		id, 
		parent_id, 
		1 depth,
		'' || id path
	FROM transcription_attempt ta 
	WHERE id IN(:attemptId)
		-- parent_id IS NULL
	
	UNION ALL
	
	SELECT 
		ta.id, 
		ta.parent_id, 
		desc.depth + 1 depth,
		desc.path || '/' || ta.id path
	FROM transcription_attempt ta 
	INNER JOIN ta_desc desc
		ON ta.parent_id = desc.id
),
ta_desc_depths AS (
	SELECT 
		depth,
		COUNT(*) count
	FROM ta_desc
	GROUP BY depth
	ORDER BY depth
),
--SELECT * FROM ta_desc_depths
ta_desc_agg AS (
	SELECT 
		COUNT(*) attempt_count,
		MAX(depth) max_depth,
		AVG(depth) mean_depth,
		SQRT(AVG(depth * 1.0 * depth) - AVG(depth) * AVG(depth)) depth_stdev
		
	FROM ta_desc
),
t_agg AS (
	SELECT 
		desc.id,
		COUNT(*) transcription_count,
		SUM(is_active) active_count,
		SUM(is_suspect) suspect_count,
		MAX(to_offset) attempt_length,
		MIN(LENGTH(text)) min_text_length,
		MAX(LENGTH(text)) max_text_length,
		AVG(LENGTH(text)) mean_text_length
		
	FROM ta_desc desc
	INNER JOIN transcription t
		ON desc.id = t.attempt_id
	GROUP BY desc.id
),
t_agg_agg AS (
	SELECT 
		SUM(transcription_count) total_transcription_count,
		AVG(transcription_count) mean_transcription_count,
		SUM(active_count) total_active_count,
		SUM(suspect_count) total_suspect_count,
		SUM(suspect_count)*1.0/SUM(transcription_count) suspect_rate,
		MAX(attempt_length) max_attempt_length,
		AVG(attempt_length) mean_attempt_length,
		MIN(min_text_length) min_text_length,
		MAX(max_text_length) max_text_length,
		SUM(transcription_count * mean_text_length) / SUM(transcription_count) mean_text_length
		
	FROM t_agg
),

ta_agg AS (
	SELECT 
		ta_desc_agg.*,
		t_agg_agg.*,
		SUM(CASE WHEN depth = ta_desc_agg.max_depth THEN 1 ELSE 0 END) max_depth_count,
		MAX(ta.end_time - ta.start_time) max_child_length,
		AVG(COALESCE(ta.end_time - ta.start_time, t_agg_agg.max_attempt_length)) mean_descendant_length,
		SQRT(
			AVG((ta.end_time - ta.start_time) * 1.0 * (ta.end_time - ta.start_time)) 
				- AVG((ta.end_time - ta.start_time)) 
				* AVG((ta.end_time - ta.start_time))
		)
			stdev_descendant_length,
		SQRT(
			AVG(COALESCE(ta.end_time - ta.start_time, t_agg_agg.max_attempt_length) * 1.0 * COALESCE(ta.end_time - ta.start_time, t_agg_agg.max_attempt_length)) 
				- AVG(COALESCE(ta.end_time - ta.start_time, t_agg_agg.max_attempt_length)) 
				* AVG(COALESCE(ta.end_time - ta.start_time, t_agg_agg.max_attempt_length))
		)
			stdev_total_length
		
	FROM 
		ta_desc desc, 
		ta_desc_agg,
		t_agg_agg
	
	INNER JOIN transcription_attempt ta
		ON desc.id = ta.id
)

SELECT *
FROM ta_agg
;