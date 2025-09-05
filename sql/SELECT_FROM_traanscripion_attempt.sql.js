'use strict';
//import TranscriptionAttempt from './model/TranscriptionAttempt';
const {camelCase, snakeCase} = require('change-case');

/**
 * @param {TranscriptionAttempt} attemptConds 
 * @returns string
 */
module.exports = (attemptConds) => {
    const 
        parameters = {},
        sql =  
`SELECT 
    *
FROM transcription_attempt
WHERE
    ${
        // TODO Replace w/ some reflection of model or db
        ['id','parentId','file'].map(prop => {
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
            // this is lazy and isn't doing snake-to-camel or vice versa cases
            return `"${col}" IN(:${prop})`

        }).filter(v => !!v).join('\n    AND ')
    }
`
    ;
    return { sql, parameters };
};