'use strict';
const 
    // Make log() and error() convenient
    {log, error} = console,
    // Use a tried and true Promise implmentatino
    Promise = require('bluebird'),
    // For executing our ffmpeg/whisper calls
    {exec} = require('node:child_process'),
    // File System
    fs = require('fs'),
    path = require("node:path"),
    enc = {encoding: 'utf8'},
    // For generating string hashes
    crypto = require('crypto'),
    {camelCase, snakeCase} = require('change-case/keys'),
    // Configuration
    cfg = require('./config'),
    // Working Directory
    {wd} = cfg,
    // Our SQLite database helper
    db = require('./db'),
    // Our databas models
    TranscriptionAttempt = require('./db/model/TranscriptionAttempt'),
    Transcription = require('./db/model/Transcription'),
    TranscriptionRange = require('./db/model/TranscriptionRange'),
    // Input video/audio filename
    file = path.resolve(process.argv[process.argv.length - 1]),
    // Output subtitle filename
    srtFile =  path.resolve(cfg.scribe?.srtFileTransform?.(file) || `${file}.srt`),
    //srtFile =  path.resolve(`${wd}/output.srt`),
    // Optional input prompt filename
    promotFile = cfg.scribe?.promotFile || `${wd}/prompt.txt`,
    // Maximum depth main() is allowed to recurse.
    // Notice: there is no limit on breadth of attempts.
    MAX_RECURSION = cfg.maxRecursion || 9
;

/**
 * Transform object key/value pairs into 
 * CLI arguments to ffmpeg and whisper
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
 * Normalize wav filename so it's unique and human readable
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
 * Run the necessary chain of commands to generate an attempt JSON file.
 * Using source file, ffmpeg, tee, and whisper.
 * @param {TranscriptionAttempt} attempt 
 * @param {object} options
 * @returns {Promise<void>} resolves on success
 * @throws {Error} and rejects on failure
 */
function transcribe(attempt, options = {}) { return new Promise((res, rej) => 
{
    const 
        // Note About Larger models 
        // - They tend to do better at guessing the right words.
        // - They do run slower than the smaller ones.
        // - They don't get better at avoiding stuttering much.
        model = options?.model || cfg.scribe?.model || './models/ggml-large-v3-turbo.bin',
        // Instead of Whisper directly generating a srt file
        // We have it generate a JSON file unique for this attempt
        attemptFile = attemptJsonFilename(attempt),
        // Because it takes resources to convert a video file into wav,
        // And because we potentially have to run numerous attempts,
        // And because it may not be performant to access the source file;
        // We cache a copy (with tee) in a wav file.
        wavFile = wavFilename(attempt),
        ffmpegArgs = {
            // Start timestamp.  Default to beginning of file
            // If we're recursing, use attempt ranges
            ss: Number.isInteger(attempt.startTime) ? attempt.startTime : undefined,
            // End timestamp.  Default to end of file
            to: Number.isInteger(attempt.endTime) ? attempt.endTime : undefined,
            // Out vidoe file input
            i: attempt.file,
            // Output a wav container
            f: 'wav',
            // Audio codec
            acodec: 'pcm_s16le',
            // Whisper only cares about mono audio
            ac: 1,
            // Whisper was trained at this sample rate
            ar: 16000
        },
        cliArgs = {
            // # of processes/equal chunks Whisper will divide on its own
            p: null,
            // # of threads to use per process
            t: 20,
            // Best of. Keep odd
            bo: 7,
            // Beam size
            bs: 7,
            // Do not use temperature fallback while decoding 
            nf: true,
            // No speech threshold
            nth: 0.20,
            // maximum segment length in characters
            ml: 200,
            //tp: 0.05,
            m: model,
            // Output a JSON file
            ojf: true,
            // whisper-cli will re-append this extension
            of: attemptFile.replace(/\.json$/i, '')
        },
        // Be sure to include the cwd of whisper.cpp base dir
        execOptions = cfg.scribe.execOptions
    ;

    // Prompt files allow certain behaviors to be passed in to all transcriptions.
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

    // Notice: we aren't checking the attempt state
    // So as long as the cache file is present, we'll use it.
    // Also Notice: This option can be overriden.
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
    log('exec():', cmd);
    const child = exec(cmd, execOptions);

    child.stdout.on('data', (data) => process.stdout.write(data));
    child.stderr.on('data', (data) => process.stderr.write(data));
    child.on('error', rej);
    child.on('close', (code) => {
        if(!code)
        {
            res();
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