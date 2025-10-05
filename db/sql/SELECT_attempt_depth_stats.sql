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
        MAX(depth)     AS max,
        -- AVG(depth^2) - AVG(depth)^2
        AVG(depth * 1.0 * depth) - AVG(depth) * AVG(depth) variance
    FROM ta_desc
),
moments AS (
    SELECT
        max,
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
),
occurances AS (
    SELECT 
        SUM(CASE depth WHEN mode THEN 1 ELSE 0 END) mode_count,
        SUM(CASE depth WHEN mode THEN 1 ELSE 0 END) * 1.0 / COUNT(*) mode_rate,
        SUM(CASE depth WHEN median THEN 1 ELSE 0 END) median_count,
        SUM(CASE depth WHEN median THEN 1 ELSE 0 END) * 1.0 / COUNT(*) median_rate,
        SUM(CASE depth WHEN max THEN 1 ELSE 0 END) max_count,
        SUM(CASE depth WHEN max THEN 1 ELSE 0 END) * 1.0 / COUNT(*) max_rate

    FROM 
        ta_desc,
        stats,
        mode,
        median
)
SELECT
    mo.mode,
    md.median,
    mo2.max,
    mo2.mean,
    mo2.variance,
    mo2.stdev,
    mo2.skewness,
    occ.*
FROM moments mo2
JOIN median md
JOIN mode mo
JOIN occurances occ