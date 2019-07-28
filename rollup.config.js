// rollup.config.js
import nodeResolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import { terser } from 'rollup-plugin-terser';

export default [{
  input: 'main.js',
  output: {
    file: 'dist/ch-script.js',
    format: 'iife',
    name: 'contractionHierarchy'
  },
  plugins: [
    nodeResolve(),
    commonjs()
  ]
}, {
  input: 'main.js',
  output: {
    file: 'dist/ch-umd.js',
    format: 'umd',
    name: 'contractionHierarchy'
  },
  plugins: [
    nodeResolve(),
    commonjs()
  ]
}, {
  input: 'main.js',
  output: {
    file: 'dist/ch-umd.min.js',
    format: 'umd',
    name: 'contractionHierarchy'
  },
  plugins: [
    nodeResolve(),
    commonjs(),
    terser()
  ]
}];
