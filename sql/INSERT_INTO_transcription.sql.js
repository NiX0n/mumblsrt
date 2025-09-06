INSERT INTO transcription (
    attempt_id,
    from_offset,
    to_offset,
    text,
    tokens
)
VALUES (
    :attemptId,
    :fromOffset,
    :toOffset,
    :text,
    :tokens
)
RETURNING *
;