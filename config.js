'use strict';
const 
    // Working Directory for all of our temporary persistent media
    // @TODO add garbage collection
    // Optionally, use system-generated temporary folder
    wd = `${__dirname}/tmp` || fs.mkdtempSync()
;
module.exports = {
    wd,
    // It can go all the way up to eleven.  If we need that extra push over the cliff.
    //maxRecursion: 11,
    scribe: {
        srtFileTransform: (file) => file.replace(/\.[^\.]+$/, '.mumbl.srt'),
        model: './models/ggml-large-v3-turbo.bin',
        // Override any default global transcription options here
        // Notice: this application was developed on a system with 20 threads available.
        // Tip: Optimize the "t" option as necessary.
        options: {},
        // Apply transcription options overriding only at specific recursion depths
        depthOptions: {
            // On the base run, go ahead and let whisper subdivide into smaller (4) chunks on its own
            // However, subsequent recursions should stick to one process only since the child
            // runs may be significantly smaller and could be problematic subdividing
            // Notice: 4*5==20
            '1' : {
                p: 4,
                t: 5
            },
            // If we've gotten this far down, let's try a different model to mix it up
            // Before giving up completely
            '8' : {
                model: './models/ggml-base.en.bin'
            },
            '9' : {
                model: './models/ggml-tiny.en.bin'
            }
        },
        execOptions: {
            // The location of 
            cwd: `${process.env.HOME}/src/whisper.cpp/`
        }
    },
    db: {
        path:
            // SQLite supports running the whole database in memory
            // This could be helpful in some scenarios.
            //':memory:'

            // However, this application was designed to 
            // pick up from the last attempt, in case of failures.
            `${wd}/db.sqlite3`
    }
};