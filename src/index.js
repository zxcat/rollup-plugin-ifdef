import { createFilter } from 'rollup-pluginutils'
import MagicString from 'magic-string'
import { resolve } from 'path'
import fs from 'fs'

/*
  {
    defines: {
      IS_MOCK: true,
    }
  }
 */
function parseDefines (defines, patterns) {
  if (isObject(defines)) {
    for (const defineName in defines) {
      const pass = defines[defineName]
      if (pass) {
        patterns.push({
          test: makeIfDefRegexp(defineName),
          replace: '{$1}'
        })
      } else { // remove define blocks
        patterns.push(
          {
            test: makeIfDefRegexp(defineName),
            replace: ''
          },
          {
            test: makeDefineRegexp(defineName),
            replace: ''
          }
        )
      }
      patterns.push({
        test: makeIfElseRegexp(defineName),
        replace: pass ? '{$1}' : '{$2}'
      })
    }
  }
}

/*
  {
    replaces: {
      Host: `'localhost'`,        // replace
    }
  }
*/
function parseReplaces (replaces, patterns) {
  if (isObject(replaces)) {
    for (const replaceName in replaces) {
      patterns.push({
        test: replaceName,
        replace: replaces[replaceName]
      })
    }
  }
}

/*
  {
    patterns: [
      {
        include: 'String|Regexp',
        exclude: 'String|Regexp',
        match: 'String|Regexp|Function',

        test: 'String|RegExp',

        replace: 'String|Function',
        file: 'String',
        text: 'String',

        transform: 'Function'
      }
    ]
  }
*/
function parsePatterns (patterns, contents) {
  patterns.forEach((it) => {
    if (it._pass) {
      return contents.push(it)
    }
    // filter
    it.filter = createFilter(it.include, it.exclude)

    // match
    if (isFunction(it.match)) {
      it.matcher = it.match
    } else if (isRegExp(it.match)) {
      it.matcher = it.match.test.bind(it.match)
    } else if (isString(it.match)) {
      it.matcher = createFilter(it.match)
    }
    // test
    if (isRegExp(it.test)) {
      it.testIsRegexp = true
    } else if (isString(it.test)) {
      it.testIsString = true
    }
    // replace
    if (isString(it.replace)) {
      it.replaceIsString = true
    } else if (isFunction(it.replace)) {
      it.replaceIsFunction = true
    }
    // content by file
    if (isString(it.file)) {
      it.replaceContent = (res) => {
        const file = resolve(res.id, '../', it.file)
        try {
          res.content = fs.readFileSync(file).toString()
        } catch (err) {
          throw new Error('[rollup-plugin-ifdef] can not readFile: ' + file)
        }
      }
    }
    // text
    if (isString(it.text)) {
      it.replaceContent = (res) => {
        res.content = it.text
      }
    }
    contents.push(it)
  })
}

function verbose (opts, result, id) {
  if (opts.verbose) {
    if (isFunction(opts.verbose)) {
      opts.verbose(result, id)
    } else {
      console.log(`[${result}]`, id)
    }
  }
}

export default function replace (options = {}) {
  const filter = createFilter(options.include, options.exclude)
  const contents = []
  const patterns = options.patterns || (options.patterns = [])
  parseDefines(options.defines, patterns)
  parseReplaces(options.replaces, patterns)
  parsePatterns(patterns, contents)
  return {
    name: 'ifdef',
    transform (code, id) {
      if (!filter(id)) {
        verbose(options, 'exclude', id)
        return
      }
      if (!contents.length) {
        verbose(options, 'ignore', id)
        return
      }
      const MAX_PASSES = 10
      let result
      let pass = 0
      let retry
      // To process nested conditions we should process outer first, so delay regex replace
      let regexToDo
      do {
        retry = false
        regexToDo = []
        if (pass) {
          verbose(options, 'pass', pass + 1)
        }
        const hasReplacements = { c: 0, t: 0, r: 0, s: 0 } // detailed info, which replacement types used
        let magicString = new MagicString(code)
        contents.forEach((pattern) => {
          if (!pattern.filter(id)) {
            return
          }
          if (pattern.matcher && !pattern.matcher(id)) {
            return
          }
          // replace content
          if (pattern.replaceContent) {
            const res = {
              id,
              code,
              magicString
            }
            pattern.replaceContent(res)
            if (isString(res.content) && res.content !== code) {
              hasReplacements.c++
              magicString = new MagicString(res.content)
              code = res.content
            }
          }
          // transform
          if (isFunction(pattern.transform)) {
            const newCode = pattern.transform(code, id)
            if (isString(newCode) && newCode !== code) {
              hasReplacements.t++
              magicString = new MagicString(newCode)
              code = newCode
            }
          }
          // test & replace
          if (pattern.testIsRegexp) {
            let match = pattern.test.exec(code)
            let start, end
            while (match) {
              hasReplacements.r++
              start = match.index
              end = start + match[0].length
              let str
              if (pattern.replaceIsString) {
              // fill capture groups
                str = pattern.replace.replace(/\$\$|\$&|\$`|\$'|\$\d+/g, m => {
                  if (m === '$$') {
                    return '$'
                  }
                  if (m === '$&') {
                    return match[0]
                  }
                  if (m === '$`') {
                    return code.slice(0, start)
                  }
                  if (m === "$'") {
                    return code.slice(end)
                  }
                  const n = +m.slice(1)
                  if (n >= 1 && n < match.length) {
                    return match[n] || ''
                  }
                  return m
                })
              } else {
                str = pattern.replace.apply(null, match)
              }
              if (!isString(str)) {
                throw new Error('[rollup-plugin-ifdef] replace function should return a string')
              }
              regexToDo.push({ start, end, str })
              match = pattern.test.global ? pattern.test.exec(code) : null
            }
          } else if (pattern.testIsString) {
            let start, end
            const len = pattern.test.length
            let pos = code.indexOf(pattern.test)
            while (pos !== -1) {
              hasReplacements.s++
              start = pos
              end = start + len
              if (pattern.replaceIsString) {
                magicString.overwrite(start, end, pattern.replace)
              } else if (pattern.replaceIsFunction) {
                const str = pattern.replace(id)
                if (!isString(str)) {
                  throw new Error('[rollup-plugin-ifdef] replace function should return a string')
                }
                magicString.overwrite(start, end, str)
              }
              pos = code.indexOf(pattern.test, pos + 1)
            }
          }
        })

        const { c, t, r, s } = hasReplacements
        if (!(c + t + r + s)) {
          return
        }
        if (regexToDo.length) {
          // sort by left side
          regexToDo.sort((a, b) => { return a.start - b.start })

          // remove inner (nested) matches to process them on the next pass
          let prev
          regexToDo.forEach(r => {
            const { start, end, str } = r
            if (prev) {
              const inside = start > prev.start && end < prev.end
              if (inside) {
                retry = true
                return
              }
            }
            prev = r
            magicString.overwrite(start, end, str)
          })
        }

        verbose(options, `replaces: c:${c}, t:${t}, r:${r}, s:${s}`, id)
        result = { code: magicString.toString() }

        if (options.sourceMap !== false) {
          result.map = magicString.generateMap({ hires: true })
        }

        code = result.code
      } while (pass++ < MAX_PASSES && retry)
      return result
    }
  }
}

const source = /\/\/\s#if\sIS_DEFINE(.*)([\s\S]*?)\/\/\s#endif/g.source
const ifdef = /if\s*\(def\('IS_DEF'\)\)\s*\{\s*\/\/\s#if[^\n]*\n((?:(?!def\('IS_DEF'\))[\s\S])*)\}\s*\/\/\s#end\sIS_DEF/.source
const ifelse = /if\s*\(def\('IS_DEF'\)\)\s*\{\s*\/\/\s#if[^\n]*\n((?:(?!def\('IS_DEF'\))[\s\S])*)\}\s*else\s*\{\s*\/\/\s#else\sIS_DEF[^\n]*\n((?:(?!def\('IS_DEF'\))[\s\S])*)\}\s*\/\/\s#eend\sIS_DEF/.source

function makeIfDefRegexp (text) {
  return new RegExp(ifdef.replace(/IS_DEF/g, text), 'g')
}
function makeIfElseRegexp (text) {
  return new RegExp(ifelse.replace(/IS_DEF/g, text), 'g')
}

function makeDefineRegexp (text) {
  return new RegExp(source.replace('IS_DEFINE', text), 'g')
}

function isRegExp (re) {
  return Object.prototype.toString.call(re) === '[object RegExp]'
}

function isString (str) {
  return typeof str === 'string'
}

function isFunction (val) {
  return typeof val === 'function'
}

function isObject (val) {
  return val !== null && Object.prototype.toString.call(val) === '[object Object]'
}
