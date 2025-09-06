INSERT INTO transcription_attempt (
    parent_id,
    file,
    start_time,
    end_time
)
VALUES (
    :parentId,
    :file,
    :startTime,
    :endTime
)
RETURNING *
;