'use strict';
const 
    Transcription = require('../model/Transcription'),
    {camelCase, snakeCase} = require('change-case')
;
/**
 * @param {Transcription} transcription 
 * @returns string
 */
module.exports = (transcription) => 
{
    const 
        columnNames = [],
        parameters = {}
    ;
    Transcription.propertyNames.forEach(prop => {
        if(
            typeof transcription[prop] === 'undefined'
            || transcription[prop] === null
        )
        {
            return;
        }
        
        const col = snakeCase(prop);
        columnNames.push(col);
        parameters[prop] = transcription[prop];
    });

    if(!columnNames.length)
    {
        throw new Error("Missing any column values");
    }

    const sql =  
`INSERT INTO transcription (
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