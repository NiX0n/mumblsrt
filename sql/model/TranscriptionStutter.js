'use strict';
class TranscriptionStutterBase
{
    attemptId;
    groupId;
    text;
    minId;
    maxId;
    minFromOffset;
    maxToOffset;
    count;
}

module.exports = class TranscriptionStutter extends require('./Mixin')(TranscriptionStutterBase) {};