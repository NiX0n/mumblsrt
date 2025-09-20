'use strict';
const 
    {log, error} = console,
    Promise = require('bluebird'),
    {exec, execSync, spawn} = require('node:child_process'),
    fs = require('fs'),
    path = require("node:path"),
    enc = {encoding: 'utf8'},
    cfg = require('./config'),
    {wd} = cfg,
    crypto = require('crypto'),
    file = path.resolve(process.argv[process.argv.length - 1]),
    srtFile =  path.resolve(cfg.scribe?.srtFileTransform?.(file) || `${file}.srt`),
    //srtFile =  path.resolve(`${wd}/output.srt`),
    promotFile = cfg.scribe?.promotFile || `${wd}/prompt.txt`,
    MAX_RECURSION = 9,
    {camelCase, snakeCase} = require('change-case/keys'),
    db = require('./db'),
    TranscriptionAttempt = require('./db/model/TranscriptionAttempt'),
    Transcription = require('./db/model/Transcription'),
    TranscriptionRange = require('./db/model/TranscriptionRange')
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
        if(
            typeof value === 'undefined'
            || value === null
        )
        {
            continue;
        }
        if(typeof value === 'string')
        {
            // TODO Escape quotes
            value = '"'+value+'"';
        }
        if(value === true)
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
        model = options?.model || cfg.scribe?.model || './models/ggml-large-v3-turbo.bin',
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
            p: null,
            t: 20,
            bo: 7,
            bs: 7,
            nf: true,
            nth: 0.20,
            ml: 200,
            //tp: 0.05,
            m: model,
            ojf: true,
            // whisper-cli will re-append this extension
            of: attemptFile.replace(/\.json$/i, '')
        },
        execOptions = cfg.scribe.execOptions
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
        if(Object.prototype.hasOwnProperty.call(cliArgs, op))
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
        transcriptions = data.transcription.map(t => new Transcription ({ 
            attemptId: attempt.id,
            fromOffset: t.offsets.from,
            toOffset: t.offsets.to,
            text: t.text,
            tokens: JSON.stringify(t.tokens)
        }))
    ;
    
    db.insertTranscriptions(transcriptions);
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
        db.updateTranscriptions({
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

    if(!db.isDbInit())
    {
        db.initDb();
    }

    // If no attempt passed (base recursion run)
    // Or our passed attempt hasn't found yet
    if(!attempt?.id)
    {
        attempt = db.fetchAttempt(attempt || {file}) || attempt;
    }

    // If we've never run against this file before
    if(!attempt?.id)
    {
        attempt = db.insertAttempt(attempt || {file: file});
    }

    log('Attempt:', attempt);
    //if(attempt?.parentId) { log('recursion over'); return; }

    if(!db.hasTranscriptions(attempt))
    {
        if(!fs.existsSync(attemptJsonFilename(attempt)))
        {
            await transcribe(attempt,
                Object.assign(
                    {},
                    cfg.scribe?.options || {}, 
                    cfg.scribe?.depthOptions[main._depth] || {}
                )
            );
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
    
    const stutterings = db.fetchTranscriptionStutter(attempt);
    if(!stutterings?.length)
    {
        log("No inter-transcription stuttering in this attempt");
    }
    else
    {
        log('Transcriptin stuttering found:', stutterings.length);
        flagRangeSuspect(stutterings);
    }

    const zeroLens = db.fetchZeroLengthTranscriptions(attempt);
    if(zeroLens.length)
    {
        log('Zero length transcription ranges found:', zeroLens.length);
        flagRangeSuspect(zeroLens);
    }

    const suspects = db.fetchSuspectTranscriptions(attempt);
    for(const suspect of suspects)
    {
        log('Suspect found:', suspect);
        // De-Activate stuttering transcriptions
        db.updateTranscriptions({
            isActive: 0
        }, {
            id: {min: suspect.minId, max: suspect.maxId}
        });

        const childAttempt = new TranscriptionAttempt({
            // ffmpeg appears it can only slice to an accuracy of a second
            // so we'll floor()/ceil() to the nearest second around the problematic timestamps
            // NOTE: This can result in some overlapping transcriptions.
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

    // Is this the base recursion run of main()?
    // If so, let's finalize our work
    if(!attempt?.parentId)
    {
        // Render the merged transcriptions from all the attempts
        const 
            transcriptions = db.fetchMergedTranscriptions(attempt),
            srt = require('./srt')(transcriptions)
        ;
        //log(`Writing to srt file:`, srtFile);
        fs.writeFileSync(srtFile, srt, enc);
        log(`Successfully generated srt file:`, srtFile);
        log('Runtime (secs):', process.uptime());
    }
})();