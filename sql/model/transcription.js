export default class Transcription
{
    /**
     * @type {number}
     */
    id;

    /**
     * @type {number}
     */
    attempt_id;

    /**
     * @type {number}
     */
    isActive;

    fromOffset;
    toOffset;
    text;
    tokens;
}