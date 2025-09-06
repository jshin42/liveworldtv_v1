const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: 'production',
  entry: {
    'background/background': './src/background/background.ts',
    'content/youtube-content-script': './src/content/youtube-content-script.ts',
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
  plugins: [
    new CopyPlugin({
      patterns: [
        // Copy manifest
        { from: 'manifest.json', to: 'manifest.json' },
        
        // Copy popup HTML
        { from: 'src/popup/popup.html', to: 'popup/popup.html' },
        { from: 'src/popup/youtube-popup.html', to: 'popup/youtube-popup.html' },
        
        // Copy offscreen worker
        { from: 'src/offscreen/offscreen.html', to: 'offscreen.html' },
        
        // Copy ONNX models
        { from: 'models/*.onnx', to: 'models/[name][ext]' },
        
        // Copy ONNX Runtime Web WASM files
        { 
          from: 'node_modules/onnxruntime-web/dist/*.wasm', 
          to: 'onnxruntime-web/[name][ext]'
        },
        {
          from: 'node_modules/onnxruntime-web/dist/*.js',
          to: 'onnxruntime-web/[name][ext]'
        },
        
        // Copy icons (if they exist)
        { from: 'icons', to: 'icons', noErrorOnMissing: true }
      ],
    }),
  ],
  optimization: {
    minimize: true
  },
  devtool: 'source-map'
};