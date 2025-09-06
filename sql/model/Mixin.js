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
         * @param {Base|object|null} props 
         * @param {object|boolean} optionsOrIsRow 
         */
        constructor(props = null, optionsOrIsRow = false)
        {
            super(props, optionsOrIsRow);
            if(!props)
            {
                return;
            }

            const isRow = 
                optionsOrIsRow === true 
                || !!optionsOrIsRow?.isProps
            ;
            this.assign(props, isRow);
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