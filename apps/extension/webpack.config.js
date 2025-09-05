const path = require('path');

module.exports = {
  mode: 'production',
  entry: {
    'background/background': './src/background/background.ts',
    'content/content-script': './src/content/content-script.ts',
    'content/youtube-content-script': './src/content/youtube-content-script.ts',
    'popup/popup': './src/popup/popup.ts',
    'workers/audio-processor': './src/workers/audio-processor.js'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true
  },
  resolve: {
    extensions: ['.ts', '.js'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@shared': path.resolve(__dirname, '../../packages/shared-types/src')
    }
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: {
          loader: 'ts-loader',
          options: {
            configFile: 'tsconfig.build.json'
          }
        },
        exclude: [/node_modules/, /\.spec\.ts$/, /\.test\.ts$/, /src\/test\//]
      },
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
          }
        }
      }
    ]
  },
  optimization: {
    minimize: true
  },
  devtool: 'source-map'
};