const path = require('path');

module.exports = {
  entry: './src/frontend/index.mjs',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'public'),
  },
  mode: 'development'
};
