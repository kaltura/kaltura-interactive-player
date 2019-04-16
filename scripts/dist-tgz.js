var fs = require('fs');
var archiver = require('archiver');
const { version: version } = require("../package.json");
var output = fs.createWriteStream('./dist/'+version+'.tar.gz');
var archive = archiver('tar', {
  gzip: true,
  zlib: { level: 9 } // Sets the compression level.
});

archive.on('error', function(err) {
  throw err;
});

// pipe archive data to the output file
archive.pipe(output);

// append files
archive.file('./dist/path-kaltura-player.js', {name: 'path-kaltura-player.js'});
archive.file('./dist/path-kaltura-player.js.map', {name: 'path-kaltura-player.js.map'});

// Wait for streams to complete
archive.finalize();

console.log("Done tgz");

