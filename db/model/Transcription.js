'use strict';
class TranscriptionBase
{
    /**
     * Primary Key (PK)
     * @type {number}
     */
    id;

    /**
     * Attempt (FK)
     * @type {number}
     */
    attemptId;

    /**
     * Only active subtitles will be used 
     * in final srt file generation
     * @type {number}
     */
    isActive;

    /**
     * Flag suspicious transcriptions.
     * Will likely be flagged as inactive.
     * @type {number}
     */
    isSuspect;    

    /**
     * Timestamp (ms) at begin of subtitle
     * @type {number}
     */
    fromOffset;

    /**
     * Timestamp (ms) at end of subtitle
     * @type {number}
     */
    toOffset;

    /**
     * Subtitle text
     * @type {string}
     */
    text;

    /**
     * JSON-encoded token data
     * Includes confidence metrics
     * associated with each subtitle token
     * @type {string}
     */
    tokens;
}

/**
 * Transcription of audio data into subtitle text.
 * Each instance was generated and identified by whisper.cpp as a phrase
 */
module.exports = class Transcription extends require('./Mixin')(TranscriptionBase) {};