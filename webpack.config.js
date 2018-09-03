module.exports = {
	mode: 'development',
	entry: './src/app.ts',
	output: {
		filename: 'bundle.js',
		path: __dirname,
		library: 'Rapt',
		libraryTarget: 'window',
		libraryExport: 'default'
	},
	module: {
		rules: [
			{
				test: /\.tsx?$/,
				loader: 'ts-loader',
				exclude: /node_modules/,
			},
		]
	},
	resolve: {
		extensions: [".tsx", ".ts", ".js"]
	},
};