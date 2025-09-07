'use strict';
const 
    {log, error} = console,
    Promise = require('bluebird'),
    {exec, execSync, spawn} = require('node:child_process'),
    wd = `${__dirname}/tmp` || fs.mkdtempSync(),
    fs = require('fs'),
    enc = {encoding: 'utf8'},
    {DatabaseSync} = require('node:sqlite'),
    dbPath = 
        //':memory:' || 
        `${wd}/db.sqlite3`,
    isDbInit = fs.existsSync(dbPath),
    db = new DatabaseSync(dbPath),
    file = process.argv[process.argv.length - 1],
    {camelCase, snakeCase} = require('change-case/keys'),
    TranscriptionAttempt = require('./sql/model/TranscriptionAttempt'),
    Transcription = require('./sql/model/Transcription'),
    TranscriptionStutter = require('./sql/model/TranscriptionStutter')
;

/**
 * 
 * @param {object} args 
 */
function objToArgs(args)
{
    let argString = '';
    for(const arg in args)
    {
        let value = args[arg];
        if(typeof value === 'undefined')
        {
            continue;
        }
        if(typeof value === 'string')
        {
            // TODO Escape quotes
            value = '"'+value+'"';
        }
        if(value === null)
        {
            value = '';
        }
        
        argString += ` -${arg} ${value}`.trimEnd()
    }
    return argString;
}

/**
 * 
 * @param {TranscriptionAttempt} attempt 
 * @param {object} options 
 */
function transcribe(attempt, options = {})
{
    return new Promise((res, rej) => {
    const 
        model = './models/ggml-large-v3-turbo.bin',
        attemptFile = attemptJsonFilename(attempt),
        ffmpegArgs = {
            ss: Number.isInteger(attempt.startTime) ? attempt.startTime : undefined,
            to: Number.isInteger(attempt.endTime) ? attempt.endTime : undefined,
            i: attempt.file,
            f: 'wav',
            acodec: 'pcm_s16le',
            ac: 1,
            ar: 16000
        },
        cliArgs = {
            t: 20,
            bo: 7,
            bs: 7,
            nf: null,
            nth: 0.20,
            ml: 200,
            m: model,
            ojf: null,
            // whisper-cli will re-append this extension
            of: attemptFile.replace(/\.json$/i, '')
        },
        execOptions = {
            cwd: `${process.env.HOME}/src/whisper.cpp/`
        }
    ;

    for(const op in options)
    {
        if(Object.prototype.hasOwnProperty.call(ffmpegArgs, op))
        {
            ffmpegArgs[op] = options[op];
        }
        if(Object.prototype.hasOwnProperty.call(cliArgsArgs, op))
        {
            cliArgs[op] = options[op];
        }
    }

    const cmd = `ffmpeg${objToArgs(ffmpegArgs)} - | ./build/bin/whisper-cli${objToArgs(cliArgs)} -f -`;
    log('Executing:', cmd);
    
    const child = exec(cmd, execOptions);

    child.stdout.on('data', log);
    child.stderr.on('data', error);
    child.on('error', rej);
    child.on('close', (code) => {
        if(!code)
        {
            res(true);
        }
        rej(`ffmpeg/whisper-cli process exited with code ${code}`);
    });
    
    });// new Promise()
}

/**
 * 
 * @param {DatabaseSync} db 
 */
function initDb(db)
{
    [
        `${__dirname}/sql/CREATE_TABLE_transcription_attempt.sql`,
        `${__dirname}/sql/CREATE_TABLE_transcription.sql`,
    ].forEach(sqlFile => {
        log(sqlFile);
        db.exec(fs.readFileSync(sqlFile, enc));
    });
}

/**
 * @param {TranscriptionAttempt|object} attempt
 * @returns {TranscriptionAttempt}
 */
function insertAttempt(attempt)
{
    log("INSERTING attempt");
    const 
        {sql, parameters} = require('./sql/INSERT_INTO_transcription_attempt.sql')(attempt),
        stmt = db.prepare(sql)
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
            {sql, parameters} = require('./sql/INSERT_INTO_transcription.sql')(transcription),
            stmt = db.prepare(sql),
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
        {sql, parameters} = require('./sql/UPDATE_transcription.sql')(changes, conds),
        stmt = db.prepare(sql)
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
        {sql, parameters} = require('./sql/SELECT_FROM_traanscripion_attempt.sql')(attemptConds),
        stmt = db.prepare(sql)
    ;
    //log(sql, parameters);
    const row = stmt.get(parameters);
    return row && new TranscriptionAttempt(row, true);
}

/**
 * @param {TranscriptionAttempt} attempt 
 * @returns {boolean}
 */
function hasTranscriptions(attempt)
{
    const 
        sql = fs.readFileSync(`${__dirname}/sql/SELECT_COUNT_FROM_transcription.sql`, enc),
        stmt = db.prepare(sql)
    ;
    return !!stmt.get({attemptId: attempt.id})?.count;
}

/**
 * @param {TranscriptionAttempt} attempt 
 * @returns {Array<TranscriptionStutter>}
 */
function fetchTranscriptionStutter(attempt)
{
    const 
        sql = fs.readFileSync(`${__dirname}/sql/SELECT_stutter_FROM_transcription.sql`, enc),
        stmt = db.prepare(sql)
    ;
    return stmt.all({attemptId: attempt.id}).map(row => new TranscriptionStutter(row, true));
}


/**
 * @param {TranscriptionAttempt} attempt 
 */
function attemptJsonFilename(attempt)
{
    return `${wd}/attempt_${attempt.id}.json`;
}

/**
 * @param {TranscriptionAttempt} attempt 
 */
function parseAndInsertTranscriptionJson(attempt)
{
    const 
        data = JSON.parse(fs.readFileSync(attemptJsonFilename(attempt), enc)),
        /**
         * @type {Array<Transcription>}
         */
        transcriptions = data.transcription.map(t => { return new Transcription ({ 
            attemptId: attempt.id,
            fromOffset: t.offsets.from,
            toOffset: t.offsets.to,
            text: t.text,
            tokens: JSON.stringify(t.tokens)
        });})
    ;

    insertTranscriptions(transcriptions);
}

/**
 * @param {TranscriptionAttempt} attempt 
 * @returns void
 */
(async function main (attempt = null) 
{
    if(!isDbInit)
    {
        initDb(db);
    }

    // If no attempt passed (base recursion run)
    // Or our passed attempt hasn't found yet
    if(!attempt?.id)
    {
        attempt = fetchAttempt(attempt || {file}) || attempt;
    }

    // If we've never run against this file before
    if(!attempt?.id)
    {
        attempt = insertAttempt(attempt || {file: file});
    }

    log('Attempt:', attempt);
    //if(attempt?.parentId) { log('recursion over'); return; }

    if(!hasTranscriptions(attempt))
    {
        if(!fs.existsSync(attemptJsonFilename(attempt)))
        {
            await transcribe(attempt);
        }
        parseAndInsertTranscriptionJson(attempt);
    }

    const stutterings = fetchTranscriptionStutter(attempt);
    if(!stutterings?.length)
    {
        log("No stuttering found");
        return;
    }

    stutterings.forEach(stutter => {
        log('Stuttering found:', stutter);
        // De-Activate stuttering transcriptions
        updateTranscriptions({
            isActive: 0
        }, {
            id: {min: stutter.minId, max: stutter.maxId}
        });

        const childAttempt = new TranscriptionAttempt({
            startTime:  Math.floor(stutter.minFromOffset / 1000),
            endTime: Math.ceil(stutter.maxToOffset / 1000),
            parentId: attempt.id,
            file: attempt.file
        });
        
        main(childAttempt);
    });

})();