const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const isDevelopment = process.env.NODE_ENV !== 'production';

module.exports = [
  // Renderer process configuration
  {
    mode: isDevelopment ? 'development' : 'production',
    entry: './src/renderer/index.tsx',
    target: 'electron-renderer',
    devtool: isDevelopment ? 'source-map' : false,
    output: {
      path: path.resolve(__dirname, 'dist/renderer'),
      filename: 'renderer.js',
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          exclude: /node_modules/,
          use: {
            loader: 'ts-loader',
            options: {
              transpileOnly: true,
            },
          },
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader', 'postcss-loader'],
        },
        {
          test: /\.(png|jpe?g|gif|svg)$/i,
          type: 'asset/resource',
        },
      ],
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js', '.jsx'],
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@shared': path.resolve(__dirname, 'src/shared'),
        '@renderer': path.resolve(__dirname, 'src/renderer'),
        '@main': path.resolve(__dirname, 'src/main'),
      },
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: './src/renderer/index.html',
      }),
    ],
    devServer: {
      port: 3000,
      hot: true,
      historyApiFallback: true,
    },
  },
  // Main process configuration
  {
    mode: isDevelopment ? 'development' : 'production',
    entry: './src/main/main.ts',
    target: 'electron-main',
    devtool: isDevelopment ? 'source-map' : false,
    output: {
      path: path.resolve(__dirname, 'dist/main'),
      filename: 'main.js',
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          exclude: /node_modules/,
          use: {
            loader: 'ts-loader',
            options: {
              transpileOnly: true,
            },
          },
        },
      ],
    },
    resolve: {
      extensions: ['.ts', '.js'],
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@shared': path.resolve(__dirname, 'src/shared'),
        '@main': path.resolve(__dirname, 'src/main'),
      },
    },
    externalsPresets: { node: true },
    externals: {
      electron: 'commonjs electron',
      path: 'commonjs path',
    },
    node: {
      __dirname: false,
      __filename: false,
    },
  },
  // Preload process configuration
  {
    mode: isDevelopment ? 'development' : 'production',
    entry: './src/main/preload.ts',
    target: 'electron-preload',
    devtool: isDevelopment ? 'source-map' : false,
    output: {
      path: path.resolve(__dirname, 'dist/main'),
      filename: 'preload.js',
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          exclude: /node_modules/,
          use: {
            loader: 'ts-loader',
            options: {
              transpileOnly: true,
            },
          },
        },
      ],
    },
    resolve: {
      extensions: ['.ts', '.js'],
    },
    externalsPresets: { node: true },
    externals: {
      electron: 'commonjs electron',
    },
  },
];
