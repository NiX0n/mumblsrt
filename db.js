'use strict';
const 
    {log, error} = console,
    Promise = require('bluebird'),
    fs = require('fs'),
    enc = {encoding: 'utf8'},
    cfg = require('./config').db,
    {DatabaseSync} = require('node:sqlite'),
    TranscriptionAttempt = require('./db/model/TranscriptionAttempt'),
    Transcription = require('./db/model/Transcription'),
    TranscriptionRange = require('./db/model/TranscriptionRange')
;
let 
    _isDbInit = cfg.path.startsWith(':') ? false : fs.existsSync(cfg.path),
    db
;

/**
 * @returns {DatabaseSync}
 */
function getDb()
{
    if(!db)
    {
        db = new DatabaseSync(cfg.path)
    }
    return db;
}

function isDbInit()
{
    return _isDbInit;
}

/**
 * 
 * @param {DatabaseSync} db 
 */
function initDb()
{
    log('Initializing database');
    [
        `${__dirname}/db/sql/CREATE_TABLE_transcription_attempt.sql`,
        `${__dirname}/db/sql/CREATE_TABLE_transcription.sql`,
    ].forEach(sqlFile => {
        getDb().exec(fs.readFileSync(sqlFile, enc));
    });
    _isDbInit = true;
}

/**
 * @param {TranscriptionAttempt|object} attempt
 * @returns {TranscriptionAttempt}
 */
function insertAttempt(attempt)
{
    log("INSERTING attempt");
    const 
        {sql, parameters} = require('./db/sql/INSERT_INTO_transcription_attempt.sql')(attempt),
        stmt = getDb().prepare(sql)
    ;
    const row = stmt.get(parameters);
    log("INSERTED attempt", attempt);
    return row && new TranscriptionAttempt(row, true);
}


/**
 * 
 * @param {Array<Transcription>} transcription 
 * @returns {Array<Transcription>}
 */
function insertTranscriptions(transcriptions)
{
    log("INSERTING transcriptions");
    const 
        inserted = []
    ;

    transcriptions.forEach(transcription => {
        //log("INSERTING transcription: ", transcription);
        const 
            {sql, parameters} = require('./db/sql/INSERT_INTO_transcription.sql')(transcription),
            stmt = getDb().prepare(sql),
            row = stmt.get(parameters)
        ;
        if(!row) { return; }
        if(transcription instanceof Transcription)
        {
            transcription.assign(row, true);
            inserted.push(transcription);
        }
        else
        {
            inserted.push(new Transcription(row, true));
        }
        
        log("INSERTED transcription:", transcription);
    });
    return inserted;
}

/**
 * @param {TranscriptionAttempt|object} transcription
 * @returns void
 */
function updateTranscriptions(changes, conds)
{
    const 
        {sql, parameters} = require('./db/sql/UPDATE_transcription.sql')(changes, conds),
        stmt = getDb().prepare(sql)
    ;
    log("UPDATING transcriptions", parameters);
    
    const rows = stmt.all(parameters);
    log("UPDATED transcriptions", rows.length);
    // TODO return something meaningful
    return true;
}


/**
 * 
 * @param {TranscriptionAttempt|object} attemptConds
 * @returns {TranscriptionAttempt|undefined}
 */
function fetchAttempt(attemptConds)
{
    const 
        {sql, parameters} = require('./db/sql/SELECT_FROM_traanscripion_attempt.sql')(attemptConds),
        stmt = getDb().prepare(sql)
    ;
    //log(sql, parameters);
    const row = stmt.get(parameters);
    return row && new TranscriptionAttempt(row, true);
}

/**
 * 
 * @param {Transcription|object} conds
 * @returns {Array<Transcription>}
 */
function fetchTranscriptions(conds)
{
    const 
        {sql, parameters} = require('./db/sql/SELECT_FROM_transcription.sql')(conds),
        stmt = getDb().prepare(sql)
    ;
    const rows = stmt.all(parameters);
    return rows?.length && rows.map(row => new Transcription(row, true));
}

/**
 * 
 * @param {Transcription|object} conds
 * @returns {Array<Transcription>}
 */
function fetchMergedTranscriptions(conds)
{
    const
        sql = require('./db/sql/SELECT_merged_FROM_transcription.sql'),
        parameters = {file: conds.file},
        stmt = getDb().prepare(sql)
    ;
    const rows = stmt.all(parameters);
    //log(rows); process.exit();
    return rows?.length && rows.map(row => new Transcription(row, true));
}

/**
 * @param {TranscriptionAttempt} attempt 
 * @returns {boolean}
 */
function hasTranscriptions(attempt)
{
    const 
        sql = fs.readFileSync(`${__dirname}/db/sql/SELECT_COUNT_FROM_transcription.sql`, enc),
        stmt = getDb().prepare(sql)
    ;
    return !!stmt.get({attemptId: attempt.id})?.count;
}


/**
 * @param {TranscriptionAttempt} attempt 
 * @returns {Array<TranscriptionRange>}
 */
function fetchTranscriptionStutter(attempt)
{
    const 
        sql = fs.readFileSync(`${__dirname}/db/sql/SELECT_windowed_stutter_FROM_transcription.sql`, enc),
        stmt = getDb().prepare(sql)
    ;
    return stmt.all({attemptId: attempt.id}).map(row => new TranscriptionRange(row, true));
}

/**
 * @param {TranscriptionAttempt} attempt 
 * @returns {Array<TranscriptionRange>}
 */
function fetchInterTranscriptionStutter(attempt)
{
    const 
        sql = fs.readFileSync(`${__dirname}/db/sql/SELECT_stutter_FROM_transcription.sql`, enc),
        stmt = getDb().prepare(sql)
    ;
    return stmt.all({attemptId: attempt.id}).map(row => new TranscriptionRange(row, true));
}

/**
 * @param {TranscriptionAttempt} attempt 
 * @returns {Array<TranscriptionRange>}
 */
function fetchIntraTranscriptionStutter(attempt)
{
    const 
        sql = fs.readFileSync(`${__dirname}/db/sql/SELECT_intrastutter_FROM_transcription.sql`, enc),
        parameters = {attemptId: attempt.id}, 
        stmt = getDb().prepare(sql)
    ;
    return stmt.all(parameters).map(row => new TranscriptionRange(row, true));
}


/**
 * @param {TranscriptionAttempt} attempt 
 * @returns {Array<TranscriptionRange>}
 */
function fetchZeroLengthTranscriptions(attempt)
{
    const 
        sql = fs.readFileSync(`${__dirname}/db/sql/SELECT_zerolens_FROM_transcription.sql`, enc),
        parameters = {attemptId: attempt.id}, 
        stmt = getDb().prepare(sql)
    ;
    return stmt.all(parameters).map(row => new TranscriptionRange(row, true));
}

/**
 * @param {TranscriptionAttempt} attempt 
 * @returns {Array<TranscriptionRange>}
 */
function fetchSuspectTranscriptions(attempt)
{
    const 
        sql = fs.readFileSync(`${__dirname}/db/sql/SELECT_suspect_ranges_FROM_transcription.sql`, enc),
        parameters = {attemptId: attempt.id}, 
        stmt = getDb().prepare(sql)
    ;
    return stmt.all(parameters).map(row => new TranscriptionRange(row, true));
}

/**
 * @param {TranscriptionAttempt} attempt 
 * @returns {object}
 */
function fetchAttemptStats(attempt)
{
    const 
        sql = fs.readFileSync(`${__dirname}/db/sql/SELECT_attempt_stats.sql`, enc),
        parameters = {attemptId: attempt.id}, 
        stmt = getDb().prepare(sql)
    ;
    return stmt.get(parameters);
}


/**
 * @param {TranscriptionAttempt} attempt 
 * @returns {object}
 */
function fetchAttemptDepthStats(attempt)
{
    const 
        sql = fs.readFileSync(`${__dirname}/db/sql/SELECT_attempt_depth_stats.sql`, enc),
        parameters = {attemptId: attempt.id}, 
        stmt = getDb().prepare(sql)
    ;
    return stmt.get(parameters);
}

module.exports = {
    isDbInit,
    initDb,
    getDb,
    insertAttempt,
    insertTranscriptions,
    updateTranscriptions,
    fetchAttempt,
    fetchTranscriptions,
    hasTranscriptions,
    fetchTranscriptionStutter,
    fetchZeroLengthTranscriptions,
    fetchSuspectTranscriptions,
    fetchMergedTranscriptions,
    fetchAttemptStats,
    fetchAttemptDepthStats
};