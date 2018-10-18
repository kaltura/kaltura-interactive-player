const webpack = require("webpack");

module.exports = {
  mode: "development",
  entry: "./src/Kip.ts",
  output: {
    filename: "bundle.js",
    path: __dirname,
    library: "Kip",
    libraryTarget: "window",
    libraryExport: "default"
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: "ts-loader",
        exclude: /node_modules/
      },
      {
        test: /\.scss$/,
        use: [
          "style-loader", // creates style nodes from JS strings
          "css-loader", // translates CSS into CommonJS
          "sass-loader" // compiles Sass to CSS, using Node Sass by default
        ]
      }
    ]
  },

  resolve: {
    extensions: [".tsx", ".ts", ".js"]
  }
};
