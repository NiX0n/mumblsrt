WITH flagged AS (
    SELECT
        *,
        LAG(text) OVER (ORDER BY id) AS prev_text
    FROM transcription
    --TODO Add WHERE
),
grouped AS (
    SELECT
        *,
        -- start a new group whenever status <> prev_status (or on the very first row)
        SUM(CASE 
            WHEN 
                prev_text IS NULL 
                OR text <> prev_text
            THEN 1 
            ELSE 0 
        END) OVER (ORDER BY id) AS group_id
    FROM flagged
)
SELECT * FROM grouped;
SELECT
    group_id,
    text,
    MIN(id) AS min_id,
    MAX(id) AS max_id,
    COUNT(*) AS count
FROM grouped
GROUP BY group_id
HAVING COUNT(*) > 4
ORDER BY group_id;