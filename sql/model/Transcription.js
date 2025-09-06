'use strict';
class TranscriptionBase
{
    /**
     * @type {number}
     */
    id;

    /**
     * @type {number}
     */
    attemptId;

    /**
     * @type {number}
     */
    isActive;

    fromOffset;
    toOffset;
    text;
    tokens;
}

module.exports = class Transcription extends require('./Mixin')(TranscriptionBase) {};