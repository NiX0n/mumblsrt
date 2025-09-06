class TranscriptionAttemptBase
{
    id;
    parentId;
    file;
    startTime;
    endTime;
}

module.exports = class TranscriptionAttempt extends require('./Mixin')(TranscriptionAttemptBase) {};