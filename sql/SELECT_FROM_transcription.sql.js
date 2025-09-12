'use strict';
const 
    Transcription = require('./model/Transcription'),
    {camelCase, snakeCase} = require('change-case'),
    {columnNames} = Transcription
;
/**
 * @param {Transcription} conds 
 * @returns {sql: string, parameters: object}
 */
module.exports = (conds) => 
{
    const 
        parameters = {},
        where = [],
        orderBy = []
    ;
    Transcription.propertyNames.forEach(prop => {
        const 
            value = conds[prop]
            col = snakeCase(prop)
        ;

        if(typeof value === 'undefined')
        {
            return;
        }
        
        if(!columnNames.includes(col))
        {
            return;
        }

        if(value === null)
        {
            where.push(`"${col}" IS NULL`);
            return;
        }

        if(typeof value?.min !== 'undefined')
        {
            const 
                minParam = `${prop}_min`,
                maxParam = `${prop}_max`
            ;
            parameters[minParam] = value.min;
            parameters[maxParam] = value.max;
            where.push(`"${col}" BETWEEN :${minParam} AND :${maxParam}`);
            return;
        }

        parameters[prop] = conds[prop];
        where.push(`"${col}" IN(:${prop})`);

    });

    if(conds.orderBy)
    {
        conds.orderBy.forEach(([col, isDesc]) => {
            if(!columnNames.includes(col))
            {
                throw new Error(`"Invalid ORDER BY column '${col}'`);
            }
            orderBy.push(`"${col}" ${isDesc ? "DESC" : "ASC"}`);
        }); 
    }

    let sql =  
`SELECT 
    *
FROM transcription
WHERE
    ${where.filter(v => !!v).join('\n    AND ')}
`
    ;
    
    if(orderBy.length)
    {
        sql += `ORDER BY ${orderBy.join(', ')}`;
    }

    return { sql, parameters };
};