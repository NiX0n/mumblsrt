'use strict';
class TranscriptionRangeBase
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

module.exports = class TranscriptionRange extends require('./Mixin')(TranscriptionRangeBase) {};