'use strict';
const 
    Transcription = require('./db/model/Transcription'),
    MILLIS = 1,
    SECONDS = 1000 * MILLIS,
    MINUTES = 60 * SECONDS,
    HOURS = 60 * MINUTES
;
/**
 * 
 * @param {Number} ts timestamp
 * @returns {string}
 */
function formatTime(ts)
{
    const hour = Math.floor(ts / HOURS);
    ts -= hour * HOURS;
    const min = Math.floor(ts / MINUTES);
    ts -= min * MINUTES;
    const sec = Math.floor(ts / SECONDS);
    ts -= sec * SECONDS;
    const ms = ts;

    return `${hour.toString().padStart(2,0)}:${min.toString().padStart(2,0)}:${sec.toString().padStart(2,0)},${ms.toString().padStart(3,0)}`;
}

/**
 * @param {Array<Transcription>} transcriptions 
 * @returns {string}
 */
module.exports = function SubtitleComposer (transcriptions)
{
    let i = 1;
    return transcriptions.map(transcription => 
`${i++}
${formatTime(transcription.fromOffset)} --> ${formatTime(transcription.toOffset)}
${transcription.text}
`
    ).join('\n');
};
