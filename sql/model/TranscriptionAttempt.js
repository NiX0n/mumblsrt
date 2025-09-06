const 
    changeCase = require('change-case'),
    changeKeysCase = require('change-case/keys')
;
const self = module.exports = class TranscriptionAttempt 
{
    /**
     * Private singleton used for lazy reflection.
     * It's not a strict singleton pattern, 
     * because we didn't make the constructor private
     * @type {self}
     */
    static #_instance;

    /**
     * @returns TranscriptionAttempt
     */
    static instance()
    {
        if(!self.#_instance) 
        {
            self.#_instance = new self();
        }
        return self.#_instance;
    }

    id;
    parentId;
    file;
    startTime;
    endTime;

    constructor(row)
    {
        if(row)
        {
            Object.assign(this, changeKeysCase.camelCase(row));
        }
    }

    /**
     * @type {Array<string>}
     */
    static get propertyNames ()
    {
        return Object.getOwnPropertyNames(self.instance());
    }

    /**
     * @type {Array<string>}
     */
    static get columnNames ()
    {
        return changeKeysCase(self.propertyNames);
    }
}