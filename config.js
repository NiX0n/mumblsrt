'use strict';
const 
    wd = `${__dirname}/tmp` || fs.mkdtempSync()
;
module.exports = {
    wd,
    whisper: {
        
    },
    db: {
        path:
            //':memory:' || 
            `${wd}/db.sqlite3`
    }
};