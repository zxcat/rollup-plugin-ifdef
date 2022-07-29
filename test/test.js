'use strict'

import test from 'ava'
import { rollup } from 'rollup'
import replace from '..'

async function getCode (bundle) {
  const { output } = await bundle.generate({})
  const { code } = output[0]
  return code
}

test('replaces strings', assert => rollup({
  input: 'test/fixtures/simple.js',
  plugins: [
    replace({
      patterns: [
        {
          test: 'process.env.NODE_ENV',
          replace: "'production'"
        },
        {
          test: /,\s*\)/g,
          replace: ')'
        },
        {
          test: /!(\w+)!/g,
          replace: function (_, words) {
            return words.toLowerCase()
          }
        },
        {
          test: /swap\((\w+), (\w+)\)/g,
          replace: '$2, $1'
        },
        {
          test: /once/,
          replace: '1'
        }
      ]
    })
  ]
}).then(getCode).then((code) => {
  assert.true(code.indexOf("'production' === 'production'") !== -1)
  assert.true(code.indexOf(', )') === -1)
  assert.true(!!~~code.indexOf('helloworld'))
  assert.true(code.indexOf('console.log(b, a)') !== -1)
  assert.true(code.indexOf("console.log('1 once')") !== -1)
}))

test('replaces with text', assert => rollup({
  input: 'test/fixtures/simple.js',
  plugins: [
    replace({
      patterns: [
        {
          text: 'exports = \'xxx\''
        }
      ]
    })
  ]
}).then(getCode).then((code) => {
  assert.true(code.indexOf('xxx') !== -1)
}))

test('replaces with file', assert => rollup({
  input: 'test/fixtures/simple.js',
  plugins: [
    replace({
      patterns: [
        {
          file: 'file.js'
        }
      ]
    })
  ]
}).then(getCode).then((code) => {
  assert.true(code.indexOf('fileContent') !== -1)
}))

test('defines', assert => rollup({
  input: 'test/fixtures/define.js',
  plugins: [
    replace({
      defines: {
        IS_HELLO: true,
        IS_BYE: false
      }
    })
  ]
}).then(getCode).then((code) => {
  assert.true(code.indexOf('!Skip!') !== -1)
  assert.true(code.indexOf('!Skip2!') !== -1)
  assert.true(code.indexOf('!HelloWorld!') !== -1)
  assert.true(code.indexOf('!HelloWorld2!') !== -1)
  assert.true(code.indexOf('!GoodBye!') === -1)
  assert.true(code.indexOf('!GoodBye2!') === -1)
}))

test('replaces', assert => rollup({
  input: 'test/fixtures/define.js',
  plugins: [
    replace({
      replaces: {
        IS_SKIP: 'IS_NO_SKIP',
        IS_BYE: 'IS_NO_BYE'
      }
    })
  ]
}).then(getCode).then((code) => {
  assert.true(code.indexOf('IS_NO_SKIP') !== -1)
  assert.true(code.indexOf('IS_NO_BYE') !== -1)
  assert.true(code.indexOf('IS_SKIP') === -1)
  assert.true(code.indexOf('IS_BYE') === -1)
}))

test('replaces with file #2', assert => rollup({
  input: 'test/fixtures/simple.js',
  plugins: [
    replace({
      patterns: [
        {
          file: './file.js',
          transform (code) {
            return code + '\ndebugger;'
          }
        }
      ]
    })
  ]
}).then(getCode).then((code) => {
  assert.true(code.indexOf('fileContent') !== -1)
  assert.true(code.indexOf('debugger;') !== -1)
}))

test('verbose', assert => {
  const ids = []
  return rollup({
    input: 'test/fixtures/simple.js',
    plugins: [
      replace({
        verbose (it) {
          ids.push(it)
        }
      })
    ]
  }).then((bundle) => {
    assert.true(ids.length === 1)
  })
})

test('#if#else', assert => rollup({
  input: 'test/fixtures/ifelse.js',
  plugins: [
    replace({
      defines: {
        YES: true,
        NO: false,
        ONE: false,
        TWO: true
      }
    })
  ]
}).then(getCode).then((code) => {
  assert.true(code.indexOf('!no!') === -1)
  assert.true(code.indexOf('!yes!') !== -1)
  assert.true(code.indexOf('!no!') === -1)
  assert.true(code.indexOf('!yes2!') !== -1)
  assert.true(code.indexOf('!not yes2!') === -1)
  assert.true(code.indexOf('!no2!') === -1)
  assert.true(code.indexOf('!not no2!') !== -1)
  assert.true(code.indexOf('!one!') === -1)
  assert.true(code.indexOf('!two!') === -1)
  assert.true(code.indexOf('!two2!') !== -1)
  assert.true(code.indexOf('!one2!') === -1)
  assert.true(code.indexOf('!yes3!') !== -1)
  assert.true(code.indexOf('!two3!') !== -1)
  assert.true(code.indexOf('!one3!') === -1)
  assert.true(code.indexOf('!three!') !== -1)
}))
