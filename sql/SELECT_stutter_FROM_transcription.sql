SELECT

FROM transcription


SELECT
    your_column,
    MIN(order_column) AS start_of_chunk,
    MAX(order_column) AS end_of_chunk,
    COUNT(*) AS rows_in_chunk
FROM (
    SELECT your_column, order_column,
    SUM(CASE WHEN your_column <> LAG(your_column, 1, your_column) OVER (ORDER BY order_column) THEN 1 ELSE 0 END) OVER (ORDER BY order_column) AS group_id
    FROM your_table
) AS grouped_data
GROUP BY your_column, group_id
ORDER BY start_of_chunk;