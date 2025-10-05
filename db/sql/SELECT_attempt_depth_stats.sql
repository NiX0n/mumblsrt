WITH RECURSIVE 
ta_desc AS (
    SELECT 
        id, 
        parent_id, 
        1 AS depth,
        '' || id AS path
    FROM transcription_attempt ta 
    WHERE id IN (:attemptId)

    UNION ALL
    
    SELECT 
        ta.id, 
        ta.parent_id, 
        d.depth + 1 AS depth,
        d.path || '/' || ta.id AS path
    FROM transcription_attempt ta 
    INNER JOIN ta_desc d
        ON ta.parent_id = d.id
),
stats AS (
    SELECT
        COUNT(*) * 1.0 AS n,
        AVG(depth)     AS mean,
        SUM((depth - AVG(depth)) * (depth - AVG(depth))) OVER () / COUNT(*) OVER () AS variance
    FROM ta_desc
),
moments AS (
    SELECT
        mean,
        variance,
        SQRT(variance) AS stdev,
        SUM(POWER(depth - mean, 3)) * 1.0 / (n * POWER(SQRT(variance), 3)) AS skewness
    FROM ta_desc, stats
),
median_calc AS (
    SELECT
        depth,
        ROW_NUMBER() OVER (ORDER BY depth) AS rn,
        COUNT(*) OVER () AS cnt
    FROM ta_desc
),
median AS (
    SELECT
        AVG(depth) AS median
    FROM median_calc
    WHERE rn IN ( (cnt+1)/2, (cnt+2)/2 )
),
mode AS (
    SELECT depth AS mode
    FROM (
        SELECT
            depth,
            COUNT(*) AS freq,
            RANK() OVER (ORDER BY COUNT(*) DESC) AS rnk
        FROM ta_desc
        GROUP BY depth
    )
    WHERE rnk = 1
)
SELECT
    mo.mode,
    md.median,
    mo2.mean,
    mo2.variance,
    mo2.stdev,
    mo2.skewness
FROM moments mo2
JOIN median md
JOIN mode mo