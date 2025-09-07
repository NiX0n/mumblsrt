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
    let 
        parameters = {},
        sql =  
`SELECT 
    *
FROM transcription
WHERE
    ${
        Transcription.propertyNames.map(prop => {
            if(typeof conds[prop] === 'undefined')
            {
                return;
            }
            
            const col = snakeCase(prop);
            if(!columnNames.includes(col))
            {
                return;
            }

            if(conds[prop] === null)
            {
                return `"${col}" IS NULL`;
            }

            parameters[prop] = conds[prop];
            return `"${col}" IN(:${prop})`

        }).filter(v => !!v).join('\n    AND ')
    }
`
    ;
    
    if(conds.orderBy)
    {
        sql += `ORDER BY ${conds.orderBy.map(([col, dir]) => {
            if(!columnNames.includes(col))
            {
                throw new Error(`"Invalid ORDER BY column '${col}'`);
            }
            return `${col} ${dir || "ASC"}`;
        }).join(', ')}`; 
    }

    return { sql, parameters };
};