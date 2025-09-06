'use strict';
//const { default: Transcription } = require('./sql/model/transcription');
const 
    {log, error} = console,
    {execSync, spawn} = require('node:child_process'),
    wd = './tmp' || fs.mkdtempSync(),
    fs = require('fs'),
    enc = {encoding: 'utf8'},
    {DatabaseSync} = require('node:sqlite'),
    dbPath = 
        //':memory:' || 
        `${wd}/db.sqlite3`,
    db = new DatabaseSync(dbPath),
    inFile = process.argv[process.argv.length - 1],
    {camelCase, snakeCase} = require('change-case/keys'),
    TranscriptionAttempt = require('./sql/model/TranscriptionAttempt')
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
 * @param {string} attemptFile 
 * @param {*} options 
 */
function attemptTrancription(attemptFile, options)
{
    //MODEL=./models/ggml-tiny.en.bin
    //#MODEL=./models/ggml-large-v3.bin
    //#MODEL=./models/ggml-large-v3-turbo-q5_0.bin
    //#MODEL=./models/ggml-medium.en.bin
    const 
        model = './models/ggml-large-v3-turbo.bin',
        ffmpegArgs = {
            // setting undefined, but specificly ordered
            ss: undefined,
            to: undefined,
            i: inFile,
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
            cwd: '~/src/whisper.cpp'
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
    log(cmd);
    log(execSync(cmd, execOptions));

    /*execSync(`ffmpeg -i "${inFile}" -f wav -acodec pcm_s16le -ac 1 -ar 16000 - | \
        ./build/bin/whisper-cli \
            -t 20 -bo 7 -bs 7 \
            -nf -nth 0.20 -ml 200 \
            -m ${model}} \
            -ojf -of "${attemptFile}" -f -
    `, );*/
}

/**
 * 
 * @param {DatabaseSync} db 
 */
function initDb(db)
{
    [
        './sql/CREATE_TABLE_transcription_attempt.sql',
        './sql/CREATE_TABLE_transcription.sql',
    ].forEach(sqlFile => {
        log(sqlFile);
        db.exec(fs.readFileSync(sqlFile, enc));
    });
}

/**
 * 
 * @param {TranscriptionAttempt} attempt 
 */
function insertAttempt(attempt)
{
    log("INSERTING attempt");
    const 
        sql = fs.readFileSync('./sql/INSERT_INTO_transcription_attempt.sql', enc),
        stmt = db.prepare(sql),
        result = stmt.run(attempt)
    ;
    attempt.id = result.lastInsertRowid;
    log("INSERTED attempt:", result);
}


/**
 * 
 * @param {Array<Transcription>} transcription 
 */
function insertTranscriptions(transcriptions)
{
    log("INSERTING transcriptions");
    const 
        sql = fs.readFileSync('./sql/INSERT_INTO_transcription.sql', enc),
        stmt = db.prepare(sql)
    ;

    transcriptions.forEach(transcription => {
        //log("INSERTING transcription: ", transcription);
        const result = stmt.run(transcription);
        transcription.id = result.lastInsertRowid;
        log("INSERTED transcription:", result);
    });
    log("INSERTED transcriptions:", result);
}

/**
 * 
 * @param {TranscriptionAttempt} attemptConds
 * @returns TranscriptionAttempt
 */
function fetchAttempt(attemptConds)
{
    const 
        {sql, parameters} = require('./sql/SELECT_FROM_traanscripion_attempt.sql')(attemptConds),
        stmt = db.prepare(sql)
    ;
    //log(sql, parameters);
    const row = stmt.get(parameters);
    return row && new TranscriptionAttempt(row);
}

let attempt = fetchAttempt({
    parentId: null,
    file: inFile
});


log(attempt);

if(!attempt)
{
    attempt = new TranscriptionAttempt({
        parentId: null,
        file: inFile,
        startTime: null,
        endTime: null
    }, true);

    insertAttempt(attempt);
    // refresh with full object for consistency
    //attempt = fetchAttempt({id: attempt.id})
}

return;
const 
    data = JSON.parse(fs.readFileSync(`${wd}/attempt_${attempt.id}.json`, enc)),
    /**
     * @type {Transcription}
     */
    transcriptins = data.transcription.map(t => { return { 
        attemptId: attempt.id,
        fromOffset: t.offsets.from,
        toOffset: t.offsets.to,
        text: t.text,
        tokens: JSON.stringify(t.tokens)
     }})
;
insertTranscriptions(transcriptins);



//attemptTrancription(inFile);