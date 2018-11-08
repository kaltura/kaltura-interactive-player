const fs = require("fs");
const versionFile = "./version.ts";
const cyan = "\x1b[36m%s\x1b[0m";
const { version: version } = require("../package.json");

console.log(
  cyan,
  "setting the version from package.json to version.ts " + version
);

fs.readFile(versionFile, "utf8", function(err, data) {
  if (err) {
    return console.log(err);
  }

  const splittedFile = data.split('"');
  const newFileContent = splittedFile[0] + '"' + version + '";';

  fs.writeFile(versionFile, newFileContent, "utf8", function(err) {
    if (err) return console.log(err);
  });
});
