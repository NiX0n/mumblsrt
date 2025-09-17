'use strict';
const 
    Transcription = require('../model/Transcription'),
    {camelCase, snakeCase} = require('change-case')
;
/**
 * @param {Transcription} changes 
 * @param {Transcription|object} conds
 * @returns {sql: string, parameters: object}
 */
module.exports = (changes, conds) => 
{
    const 
        parameters = {},
        {columnNames} = Transcription
    ;
    if(!Object.getOwnPropertyNames(changes).length)
    {
        throw new Error("No changes");
    }

    const sql =  
`UPDATE transcription 
SET 
    ${Object.getOwnPropertyNames(changes).map(c => {
        const 
            col = snakeCase(c),
            param = `set_${c}`
        ;
        if(!columnNames.includes(col))
        {
            throw new Error(`Nonexistent column '${col}'`);
        }
        parameters[param] = changes[c];
        return `"${col}" = :${param}`;
    }).join(',\n    ')}
WHERE 
    ${Object.getOwnPropertyNames(conds).map(c => {
        let
            col = snakeCase(c),
            param = `cond_${c}`,
            value = conds[c]
        ;
        if(!columnNames.includes(col))
        {
            throw new Error("Invalid condition");
        }

        // TODO find a better way to test for ranges
        if(typeof value === 'object' && Number.isInteger(value?.min))
        {
            const 
                minParam = `${param}_min`,
                maxParam = `${param}_max`
            ;
            parameters[minParam] = value.min;
            parameters[maxParam] = value.max;
            return `"${col}" BETWEEN :${minParam} AND :${maxParam}`; 
        }

        parameters[param] = value;
        return `"${col}" IN(:${param})`;
    }).join(',\n    ')}
RETURNING *
;`
    ;

    return { sql, parameters };
};