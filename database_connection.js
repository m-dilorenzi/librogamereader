var pg              = require('pg');
var parse_cs        = require('pg-connection-string').parse;

var config          = parse_cs(process.env.DATABASE_URL);
var pool            = new pg.Pool(config);

async function getActualChapter(user_id) {
    var queryString = 'SELECT actual_chapter FROM lastvisitedchapter WHERE user_id=\''+user_id+'\';';

    try {
        var result = await pool.query(queryString);
        return(result.rows[0].actual_chapter);
    } catch (error) {console.log(error);}
}

/*
async function updateActualChapter(user_id, chapter) {
    var queryString = 'UPDATE lastvisitedchapter SET actual_chapter = '+chapter+' WHERE user_id=\''+user_id+'\';';

    try {
        var result = await pool.query(queryString);
        return result;
    } catch (error) {console.log(error);}
}
*/

exports.getActualChapter    = getActualChapter;
exports.pool                = pool;
