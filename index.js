'use strict';
const 
    {log, error} = console,
    Promise = require('bluebird'),
    {exec, execSync, spawn} = require('node:child_process'),
    fs = require('fs'),
    path = require("node:path"),
    enc = {encoding: 'utf8'},
    wd = `${__dirname}/tmp` || fs.mkdtempSync(),
    crypto = require('crypto'),
    {DatabaseSync} = require('node:sqlite'),
    dbPath = 
        //':memory:' || 
        `${wd}/db.sqlite3`,
    file = process.argv[process.argv.length - 1],
    // @TODO make these paramters into this script
    srtFile = `${file}.srt`,
    promotFile = `${wd}/prompt.txt`,
    MAX_RECURSION = 7,
    {camelCase, snakeCase} = require('change-case/keys'),
    TranscriptionAttempt = require('./sql/model/TranscriptionAttempt'),
    Transcription = require('./sql/model/Transcription'),
    TranscriptionRange = require('./sql/model/TranscriptionRange')
;
let 
    isDbInit = dbPath.startsWith(':') ? false : fs.existsSync(dbPath),
    db = new DatabaseSync(dbPath)
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
 * @param {TranscriptionAttempt} attempt 
 */
function wavFilename(attempt)
{
    const 
        base = snakeCase(path.basename(attempt.file)),
        hash = crypto.createHash('md5').update(attempt.file).digest('hex')
    ;
    return `${wd}/${hash}_${base}.wav`;
}

/**
 * 
 * @param {TranscriptionAttempt} attempt 
 * @param {object} options 
 * @returns {Promise<void>} resolves on success
 * @throws {Error} and rejects on failure
 */
function transcribe(attempt, options = {}) { return new Promise((res, rej) => 
{
    const 
        model = './models/ggml-large-v3-turbo.bin',
        attemptFile = attemptJsonFilename(attempt),
        wavFile = wavFilename(attempt),
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
            p: 4,
            t: 5,
            bo: 7,
            bs: 7,
            nf: null,
            nth: 0.20,
            ml: 200,
            //tp: 0.05,
            m: model,
            ojf: null,
            // whisper-cli will re-append this extension
            of: attemptFile.replace(/\.json$/i, '')
        },
        execOptions = {
            cwd: `${process.env.HOME}/src/whisper.cpp/`
        }
    ;

    if(fs.existsSync(promotFile))
    {
        // notice that we're hacking --prompt into our shorter -scheme
        cliArgs['-prompt'] = fs.readFileSync(promotFile, enc);
    }

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

    if(
        typeof options?.i === 'undefined'
        && fs.existsSync(wavFile)
    )
    {
        // whisper-cli supports the wav file directly
        // however, we're using ffmpeg to send only 
        // specific segments of audio on subsequent passes
        ffmpegArgs.i = wavFile;
    }

    // Use ffmpeg to re-encode arbitrary video/audio sources into standard wav audio
    const cmdChain = [`ffmpeg${objToArgs(ffmpegArgs)} -`];

    if(
        // is this the first run?
        typeof ffmpegArgs.ss === 'undefined'
        // does the cache file not exist yet?
        && !fs.existsSync(wavFile)
    )
    {
        // We're goign to cache the wav stream to reduce overhead later
        cmdChain.push(`tee "${wavFile}"`);
    }

    // Use whisper to parse just the audio stream we want.
    cmdChain.push(`./build/bin/whisper-cli${objToArgs(cliArgs)} -f -`);

    // Pipe it all together
    const cmd = cmdChain.join(' | ');
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
    
});/*new Promise()*/}

/**
 * 
 * @param {DatabaseSync} db 
 */
function initDb(db)
{
    log('Initializing database');
    [
        `${__dirname}/sql/CREATE_TABLE_transcription_attempt.sql`,
        `${__dirname}/sql/CREATE_TABLE_transcription.sql`,
    ].forEach(sqlFile => {
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
 * 
 * @param {Transcription|object} conds
 * @returns {Array<Transcription>}
 */
function fetchTranscriptions(conds)
{
    const 
        {sql, parameters} = require('./sql/SELECT_FROM_transcription.sql')(conds),
        stmt = db.prepare(sql)
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
        sql = require('./sql/SELECT_merged_FROM_transcription.sql'),
        parameters = {file: conds.file},
        stmt = db.prepare(sql)
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
        sql = fs.readFileSync(`${__dirname}/sql/SELECT_COUNT_FROM_transcription.sql`, enc),
        stmt = db.prepare(sql)
    ;
    return !!stmt.get({attemptId: attempt.id})?.count;
}

/**
 * @param {TranscriptionAttempt} attempt 
 * @returns {Array<TranscriptionRange>}
 */
function fetchInterTranscriptionStutter(attempt)
{
    const 
        sql = fs.readFileSync(`${__dirname}/sql/SELECT_stutter_FROM_transcription.sql`, enc),
        stmt = db.prepare(sql)
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
        sql = fs.readFileSync(`${__dirname}/sql/SELECT_intrastutter_FROM_transcription.sql`, enc),
        parameters = {attemptId: attempt.id}, 
        stmt = db.prepare(sql)
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
        sql = fs.readFileSync(`${__dirname}/sql/SELECT_zerolens_FROM_transcription.sql`, enc),
        parameters = {attemptId: attempt.id}, 
        stmt = db.prepare(sql)
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
        sql = fs.readFileSync(`${__dirname}/sql/SELECT_suspect_ranges_FROM_transcription.sql`, enc),
        parameters = {attemptId: attempt.id}, 
        stmt = db.prepare(sql)
    ;
    return stmt.all(parameters).map(row => new TranscriptionRange(row, true));
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
 * @param {TranscriptionRange} stutterings 
 */
function flagRangeSuspect(ranges)
{
    for(const range of ranges)
    {
        log('Suspect transcription range updating:', range);
        // Flag range
        updateTranscriptions({
            isSuspect: 1
        }, {
            id: {min: range.minId, max: range.maxId}
        });
    }
}


/**
 * @param {TranscriptionAttempt} attempt 
 * @returns void
 */
(async function main (attempt = null) 
{
    main._depth = (main._depth || 0) + 1;
    if (main._depth > MAX_RECURSION) {
        throw new Error(`Recursion limit exceeded`);
    }

    log("Beginning attempt at depth:", main._depth);

    if(!isDbInit)
    {
        initDb(db);
        isDbInit = true;
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

    if(main._depth >= MAX_RECURSION)
    {
        log("Reursion limit reached. Settling with whatever we have.");
        // We've failed enough times.  Just stop.
        // Reurning early is OK, because rendering SRT only happens on base recursion run
        return;
    }

    const interStutterings = fetchInterTranscriptionStutter(attempt);
    if(!interStutterings?.length)
    {
        log("No inter-transcription stuttering in this attempt");
    }
    else
    {
        log('Inter-transcriptin stuttering found:', interStutterings.length);
        flagRangeSuspect(interStutterings);
    }

    const infraStutterings = fetchIntraTranscriptionStutter(attempt);
    if(!infraStutterings?.length)
    {
        log("No intra-transcription stuttering in this attempt");
    }
    else
    {
        log('Intra-transcriptin stuttering found:', infraStutterings.length);
        flagRangeSuspect(infraStutterings);
    }

    const zeroLens = fetchZeroLengthTranscriptions(attempt);
    if(zeroLens.length)
    {
        log('Zero length transcription ranges found:', zeroLens.length);
        flagRangeSuspect(zeroLens);
    }

    const suspects = fetchSuspectTranscriptions(attempt);
    for(const suspect of suspects)
    {
        log('Suspect found:', suspect);
        // De-Activate stuttering transcriptions
        updateTranscriptions({
            isActive: 0
        }, {
            id: {min: suspect.minId, max: suspect.maxId}
        });

        const childAttempt = new TranscriptionAttempt({
            startTime: (attempt.startTime || 0) + Math.floor(suspect.minFromOffset / 1000),
            endTime: (attempt.startTime || 0) + Math.ceil(suspect.maxToOffset / 1000),
            parentId: attempt.id,
            file: attempt.file
        }); 
        try {
            await main(childAttempt);
        } finally {
            // Always decrement depth when unwinding
            main._depth--;
        }
    };

    // Is this the base run of main()?
    if(!attempt.parentId)
    {
        // Render the merged transcriptions from all the attempts
        const 
            transcriptions = fetchMergedTranscriptions(attempt),
            srt = require('./srt')(transcriptions)
        ;
        fs.writeFileSync(srtFile, srt, enc);
        log(`Successfully generated srt file:`, srtFile);
        log('Runtime (secs):', process.uptime());
    }
})();