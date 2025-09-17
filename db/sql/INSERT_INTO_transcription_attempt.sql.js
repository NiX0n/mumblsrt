'use strict';
const 
    TranscriptionAttempt = require('./model/TranscriptionAttempt'),
    {camelCase, snakeCase} = require('change-case')
;
/**
 * @param {TranscriptionAttempt} attempt 
 * @returns {sql: string, parameters: object}
 */
module.exports = (attempt) => 
{
    const 
        columnNames = [],
        parameters = {}
    ;
    TranscriptionAttempt.propertyNames.forEach(prop => {
        if(
            typeof attempt[prop] === 'undefined'
            || attempt[prop] === null
        )
        {
            return;
        }
        
        const col = snakeCase(prop);
        columnNames.push(col);
        parameters[prop] = attempt[prop];
    });

    if(!columnNames.length)
    {
        throw new Error("Missing any column values");
    }

    const sql =  
`INSERT INTO transcription_attempt (
    ${columnNames.join(', ')}
)
VALUES (
    ${Object.getOwnPropertyNames(parameters).map(p => `:${p}`).join(', ')}
)
RETURNING *
;`
    ;

    return { sql, parameters };
};