CREATE TABLE IF NOT EXISTS transcription_attempt (
    id INTEGER PRIMARY KEY NOT NULL,
    parent_id INTEGER,
    file TEXT NOT NULL,
    start_time INTEGER,
    end_time INTEGER
) STRICT