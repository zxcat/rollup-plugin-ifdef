/*!
 * rollup-plugin-ifdef v2.0.0
 * (c) 2022 zxcat
 * Release under the MIT License.
 */
'use strict';

var rollupPluginutils = require('rollup-pluginutils');
var MagicString = require('magic-string');
var path = require('path');
var fs = require('fs');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var MagicString__default = /*#__PURE__*/_interopDefaultLegacy(MagicString);
var fs__default = /*#__PURE__*/_interopDefaultLegacy(fs);

/*
  {
    defines: {
      IS_MOCK: true,
    }
  }
 */
function parseDefines (defines, patterns) {
  if (isObject(defines)) {
    for (var defineName in defines) {
      var pass = defines[defineName];
      if (pass) {
        patterns.push({
          test: makeIfDefRegexp(defineName),
          replace: '{$1}'
        });
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
        );
      }
      patterns.push({
        test: makeIfElseRegexp(defineName),
        replace: pass ? '{$1}' : '{$2}'
      });
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
    for (var replaceName in replaces) {
      patterns.push({
        test: replaceName,
        replace: replaces[replaceName]
      });
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
  patterns.forEach(function (it) {
    if (it._pass) {
      return contents.push(it)
    }
    // filter
    it.filter = rollupPluginutils.createFilter(it.include, it.exclude);

    // match
    if (isFunction(it.match)) {
      it.matcher = it.match;
    } else if (isRegExp(it.match)) {
      it.matcher = it.match.test.bind(it.match);
    } else if (isString(it.match)) {
      it.matcher = rollupPluginutils.createFilter(it.match);
    }
    // test
    if (isRegExp(it.test)) {
      it.testIsRegexp = true;
    } else if (isString(it.test)) {
      it.testIsString = true;
    }
    // replace
    if (isString(it.replace)) {
      it.replaceIsString = true;
    } else if (isFunction(it.replace)) {
      it.replaceIsFunction = true;
    }
    // content by file
    if (isString(it.file)) {
      it.replaceContent = function (res) {
        var file = path.resolve(res.id, '../', it.file);
        try {
          res.content = fs__default["default"].readFileSync(file).toString();
        } catch (err) {
          throw new Error('[rollup-plugin-ifdef] can not readFile: ' + file)
        }
      };
    }
    // text
    if (isString(it.text)) {
      it.replaceContent = function (res) {
        res.content = it.text;
      };
    }
    contents.push(it);
  });
}

function verbose (opts, result, id) {
  if (opts.verbose) {
    if (isFunction(opts.verbose)) {
      opts.verbose(result, id);
    } else {
      console.log(("[" + result + "]"), id);
    }
  }
}

function replace (options) {
  if ( options === void 0 ) options = {};

  var filter = rollupPluginutils.createFilter(options.include, options.exclude);
  var contents = [];
  var patterns = options.patterns || (options.patterns = []);
  parseDefines(options.defines, patterns);
  parseReplaces(options.replaces, patterns);
  parsePatterns(patterns, contents);
  return {
    name: 'ifdef',
    transform: function transform (code, id) {
      if (!filter(id)) {
        verbose(options, 'exclude', id);
        return
      }
      if (!contents.length) {
        verbose(options, 'ignore', id);
        return
      }
      var MAX_PASSES = 10;
      var result;
      var pass = 0;
      var retry;
      // To process nested conditions we should process outer first, so delay regex replace
      var regexToDo;
      var loop = function () {
        retry = false;
        regexToDo = [];
        if (pass) {
          verbose(options, 'pass', pass + 1);
        }
        var hasReplacements = { c: 0, t: 0, r: 0, s: 0 }; // detailed info, which replacement types used
        var magicString = new MagicString__default["default"](code);
        contents.forEach(function (pattern) {
          if (!pattern.filter(id)) {
            return
          }
          if (pattern.matcher && !pattern.matcher(id)) {
            return
          }
          // replace content
          if (pattern.replaceContent) {
            var res = {
              id: id,
              code: code,
              magicString: magicString
            };
            pattern.replaceContent(res);
            if (isString(res.content) && res.content !== code) {
              hasReplacements.c++;
              magicString = new MagicString__default["default"](res.content);
              code = res.content;
            }
          }
          // transform
          if (isFunction(pattern.transform)) {
            var newCode = pattern.transform(code, id);
            if (isString(newCode) && newCode !== code) {
              hasReplacements.t++;
              magicString = new MagicString__default["default"](newCode);
              code = newCode;
            }
          }
          // test & replace
          if (pattern.testIsRegexp) {
            var match = pattern.test.exec(code);
            var start, end;
            while (match) {
              hasReplacements.r++;
              start = match.index;
              end = start + match[0].length;
              var str = (void 0);
              if (pattern.replaceIsString) {
              // fill capture groups
                str = pattern.replace.replace(/\$\$|\$&|\$`|\$'|\$\d+/g, function (m) {
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
                  var n = +m.slice(1);
                  if (n >= 1 && n < match.length) {
                    return match[n] || ''
                  }
                  return m
                });
              } else {
                str = pattern.replace.apply(null, match);
              }
              if (!isString(str)) {
                throw new Error('[rollup-plugin-ifdef] replace function should return a string')
              }
              regexToDo.push({ start: start, end: end, str: str });
              match = pattern.test.global ? pattern.test.exec(code) : null;
            }
          } else if (pattern.testIsString) {
            var start$1, end$1;
            var len = pattern.test.length;
            var pos = code.indexOf(pattern.test);
            while (pos !== -1) {
              hasReplacements.s++;
              start$1 = pos;
              end$1 = start$1 + len;
              if (pattern.replaceIsString) {
                magicString.overwrite(start$1, end$1, pattern.replace);
              } else if (pattern.replaceIsFunction) {
                var str$1 = pattern.replace(id);
                if (!isString(str$1)) {
                  throw new Error('[rollup-plugin-ifdef] replace function should return a string')
                }
                magicString.overwrite(start$1, end$1, str$1);
              }
              pos = code.indexOf(pattern.test, pos + 1);
            }
          }
        });

        var c = hasReplacements.c;
        var t = hasReplacements.t;
        var r = hasReplacements.r;
        var s = hasReplacements.s;
        if (!(pass + c + t + r + s)) {
          return {}
        }
        if (regexToDo.length) {
          // sort by left side
          regexToDo.sort(function (a, b) { return a.start - b.start });

          // remove inner (nested) matches to process them on the next pass
          var prev = (void 0);
          regexToDo.forEach(function (r) {
            var start = r.start;
            var end = r.end;
            var str = r.str;
            if (prev) {
              var inside = start > prev.start && end < prev.end;
              if (inside) {
                retry = true;
                return
              }
            }
            prev = r;
            magicString.overwrite(start, end, str);
          });
        }

        verbose(options, ("replaces: c:" + c + ", t:" + t + ", r:" + r + ", s:" + s), id);
        result = { code: magicString.toString() };

        if (options.sourceMap !== false) {
          result.map = magicString.generateMap({ hires: true });
        }

        code = result.code;
      };

      do {
        var returned = loop();

        if ( returned ) return returned.v;
      } while (pass++ < MAX_PASSES && retry)
      return result
    }
  }
}

var source = /\/\/\s#if\sIS_DEFINE(.*)([\s\S]*?)\/\/\s#endif/g.source;
var ifdef = /if\s*\(def\('IS_DEF'\)\)\s*\{\s*\/\/\s#if[^\n]*\n((?:(?!def\('IS_DEF'\))[\s\S])*)\}\s*\/\/\s#end\sIS_DEF/.source;
var ifelse = /if\s*\(def\('IS_DEF'\)\)\s*\{\s*\/\/\s#if[^\n]*\n((?:(?!def\('IS_DEF'\))[\s\S])*)\}\s*else\s*\{\s*\/\/\s#else\sIS_DEF[^\n]*\n((?:(?!def\('IS_DEF'\))[\s\S])*)\}\s*\/\/\s#eend\sIS_DEF/.source;

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

module.exports = replace;
