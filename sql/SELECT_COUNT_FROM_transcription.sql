SELECT COUNT(*) count
FROM transcription
WHERE attempt_id IN(:attemptId)
;