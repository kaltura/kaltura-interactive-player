"use strict";
var LiveReloadPlugin = require('webpack-livereload-plugin');

const webpack = require("webpack");
const PROD = process.env.NODE_ENV === "production";
const packageData = require("./package.json");

let plugins = [
  new webpack.DefinePlugin({
    __VERSION__: JSON.stringify(packageData.version),
    __NAME__: JSON.stringify(packageData.name)
  })
];

if (!PROD) {
	plugins.push(new LiveReloadPlugin());
}

module.exports = {
  mode: PROD ? "production" : "development",
  devServer: {
    port: 9000
  },
  entry: {
    PathKalturaPlayer: ["./src/Kip.ts"]
  },
  output: {
    path: __dirname + "/dist",
    filename: `playkit-path.js`,
    libraryTarget: 'umd',
    // `library` determines the name of the global variable
    library: '[name]',
      umdNamedDefine: true
  },
  devtool: "source-map",
  plugins: plugins,
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: [
          {
            loader: "ts-loader"
          }
        ],
        exclude: [/node_modules/]
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
