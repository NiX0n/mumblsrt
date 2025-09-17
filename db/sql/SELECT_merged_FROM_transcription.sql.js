const 
    Transcription = require('./model/Transcription'),
    {columnNames} = Transcription
;
module.exports = `SELECT 
    -- This hack prevents subtitles from showing up longer than necessary
    MAX(
        COALESCE(ta.start_time, 0) * 1000 + t.from_offset,
        (COALESCE(ta.start_time, 0) * 1000 + t.to_offset) - (LENGTH(text) * 80 + 500)
    )
        AS from_offset,
    COALESCE(ta.start_time, 0) * 1000 + t.to_offset AS to_offset,
    ${columnNames.filter(c => !['from_offset', 'to_offset'].includes(c)).map(c => `t."${c}"`).join(', ')}
FROM transcription t
INNER JOIN transcription_attempt ta
    ON t.attempt_id = ta.id
WHERE 
    ta.file IN(:file)
    AND is_active <> 0
ORDER BY from_offset
`;