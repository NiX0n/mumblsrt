CREATE TABLE IF NOT EXISTS transcription (
    id INTEGER PRIMARY KEY NOT NULL,
    attempt_id INTEGER NOT NULL,
    is_active INTEGER NOT NULL DEFAULT (1),
    is_suspect INTEGER NOT NULL DEFAULT (0),
    --from_timestamp TEXT,
    --to_timestamp TEXT,
    from_offset INTEGER,
    to_offset INTEGER,
    text TEXT,
    tokens TEXT
) STRICT