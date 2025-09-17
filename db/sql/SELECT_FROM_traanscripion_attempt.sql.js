'use strict';
const 
    TranscriptionAttempt = require('../model/TranscriptionAttempt'),
    {camelCase, snakeCase} = require('change-case')
;
/**
 * @param {TranscriptionAttempt} attemptConds 
 * @returns {sql: string, parameters: object}
 */
module.exports = (attemptConds) => 
{
    const 
        parameters = {},
        sql =  
`SELECT 
    *
FROM transcription_attempt
WHERE
    ${
        TranscriptionAttempt.propertyNames.map(prop => {
            if(typeof attemptConds[prop] === 'undefined')
            {
                return;
            }
            
            const col = snakeCase(prop);
            if(attemptConds[prop] === null)
            {
                return `"${col}" IS NULL`;
            }

            parameters[prop] = attemptConds[prop];
            return `"${col}" IN(:${prop})`

        }).filter(v => !!v).join('\n    AND ')
    }
`
    ;

    return { sql, parameters };
};