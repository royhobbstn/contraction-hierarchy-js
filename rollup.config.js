// rollup.config.js
import nodeResolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';


export default [{
  input: 'main.js',
  output: {
    file: 'dist/ch-esm.js',
    format: 'iife',
    name: 'contractionHierarchy'
  },
  plugins: [
    nodeResolve(),
    commonjs()
  ]
}];
