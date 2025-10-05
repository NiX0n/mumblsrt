'use strict';
const 
    // Make log() and error() convenient
    {log, table, error} = console,
    // Use a tried and true Promise implmentatino
    Promise = require('bluebird'),
    // File System
    fs = require('fs'),
    path = require("node:path"),
    enc = {encoding: 'utf8'},
    {camelCase, snakeCase} = require('change-case/keys'),
    // Configuration
    cfg = require('./config'),
    // Our SQLite database helper
    db = require('./db'),
    // Input video/audio filename
    file = path.resolve(process.argv[process.argv.length - 1])
;

module.exports = main;
/**
 * @param {TranscriptionAttempt} attempt 
 * @returns void
 */
async function main (attempt = null) 
{
    // If no attempt passed (base recursion run)
    // Or our passed attempt hasn't found yet
    if(!attempt?.id)
    {
        attempt = db.fetchAttempt(attempt || {file}) || attempt;
    }

    // If we've never run against this file before
    if(!attempt?.id)
    {
        throw new Error(`Couldn't find root attempt for ${file}`);
    }

    const tree = db.fetchAttemptDescendants(attempt);
    if(!tree)
    {
        throw new Error('No tree');
    }

    table(tree);
}

// Allow us to re-use this module as a sub-module of index.js
// And run it on its own
if (require.main === module)
{
    main();
}
else
{
    module.exports = main;
}