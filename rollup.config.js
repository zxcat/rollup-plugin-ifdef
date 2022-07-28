import buble from '@rollup/plugin-buble'

const pack = require('./package.json')
const YEAR = new Date().getFullYear()

export default {
  input: 'src/index.js',
  output: {
    file: 'dist/rollup-plugin-ifdef.cjs.js',
    banner () {
      return `/*!
 * ${pack.name} v${pack.version}
 * (c) ${YEAR} ${pack.author.name}
 * Release under the ${pack.license} License.
 */`
    }
  },
  plugins: [
    buble()
  ],

  // Cleaner console
  onwarn (warning, warn) {
    const msg = warning.message
    if (msg && msg.startsWith && msg.startsWith('Treating')) {
      return
    }
    warn(warning)
  }
}
