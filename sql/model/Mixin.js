'use strict';
const 
    changeCase = require('change-case'),
    changeKeysCase = require('change-case/keys')
;
module.exports = function Mixin(Base) {
    return class extends Base {
        static _instance;

        /**
         * @returns {Base|this}
         */
        static instance() {
            if (!this._instance) {
                this._instance = new this();
            }
            return this._instance;
        }

        /**
         * @type {Array<string>}
         */
        static get propertyNames() {
            return Object.getOwnPropertyNames(this.instance());
        }

        /**
         * @type {Array<string>}
         */
        static get columnNames() {
            return changeKeysCase(this.propertyNames);
        }

        /**
         * @param {Base|object|null} row 
         * @param {object|boolean} optionsOrIsProps 
         */
        constructor(row = null, optionsOrIsProps = false)
        {
            super(row, optionsOrIsProps);
            if(!row)
            {
                return;
            }

            const isProps = 
                optionsOrIsProps === true 
                || !!optionsOrIsProps?.isProps
            ;
            this.assign(row, !isProps);
        }

        /**
         * Using the same default behavior Object.assign()
         * @param {Base|object} props 
         * @param {boolean} isRow 
         * @returns {Base}
         */
        assign(props, isRow = false)
        {
            return Object.assign(this, isRow ? changeKeysCase.camelCase(props) : props);
        }
  };
};