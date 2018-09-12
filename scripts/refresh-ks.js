// this loads a KS from a localhost php file and replaces the KS in the index.html
// in case you don't have that php file - just replace it manually

const fs = require("fs");
const fetch = require("node-fetch");
const indexFile = "index.html";

console.warn(
  "Setting KS into index.html. It is expected that you have localhost with a file that generates KS for pid 27017 "
);

fetch("http://localhost/a/keep/27017.php")
  .then(res => res.text()) // parse response as text
  .then(response => {
    fs.readFile(indexFile, "utf8", function(err, data) {
      if (err) {
        return console.log(err);
      }
      const splittedFile = data.split('ks: "');
      const preKS = splittedFile[0] + 'ks: "';
      const postKS = splittedFile[1];
      const quotesPosition = postKS.indexOf('"');
      const afterQuotes = postKS.substring(quotesPosition);
      const result = preKS+response+afterQuotes;
      fs.writeFile(indexFile, result, "utf8", function(err) {
        if (err) return console.log(err);
      });
    });
  })
  .catch(err => {
    console.log(
      "Error fetching KS for pid 27017. Make sure you have the correct path and file to fetch a raw KS string"
    );
  });
