/* Cleans test rows (REMEMBER-ME-MARKER) from research.db while Core is stopped. */
const { readFileSync, writeFileSync } = require('fs');
const { join, dirname } = require('path');
const sqlJsDir = join(__dirname, '..', 'jarvis-core', 'node_modules', 'sql.js', 'dist');
const initSqlJs = require(join(sqlJsDir, 'sql-wasm.js'));

(async () => {
    const dbFile = join(__dirname, '..', 'data', 'jarvis', 'research.db');
    const SQL = await initSqlJs({
        locateFile: (file) => join(sqlJsDir, file)
    });
    const db = new SQL.Database(readFileSync(dbFile));
    const before = db.exec("SELECT COUNT(*) AS n FROM interactions WHERE content LIKE '%REMEMBER-ME-MARKER%'")[0].values[0][0];
    db.run("DELETE FROM interactions WHERE content LIKE '%REMEMBER-ME-MARKER%'");
    writeFileSync(dbFile, Buffer.from(db.export()));
    console.log('deleted test rows:', before);
})().catch((e) => {
    console.error(e);
    process.exit(1);
});
