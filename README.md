<!--[![Build Status](https://travis-ci.org/jetiny/rollup-plugin-re.svg?branch=master)](https://travis-ci.org/jetiny/rollup-plugin-re)-->

# rollup-plugin-ifdef

A fork of `rollup-plugin-re` that supports conditional building.

## Installation
…
<!--
```
npm install --save-dev rollup-plugin-ifdef
```
-->
## Usage

### #if…#end / #if…#else…#eend addon

If you didn't use original plugin, please read [the following sections](#original-description) before.

This fork adds more flexible conditional building features. It allows `if`-`else` constructs and nested `if`s.
It also support conditions in raw sources pre-built state, so you can use conditions while debug you app on local server without build.

To make this work, define somewhere (e.g. in a separate module) your own `def(d)` function like:
```js
const DEFINES = {
  ONE: true,
  TWO: false,
};

function def(d) {
  return DEFINES[d];
}
```

Then use the following constructs in your conditional code:
```js
import {def} from "./mydef.js";

if (def('ONE')) { // #if
  console.log(1);
} // #end ONE

if (def('TWO')) { // #if
  console.log(2);
} // #end TWO
```

So when uncompiled it works just as normal `if`s.

The result of processing using this plugin (if you pass the same `define` option) will be:
```js
{
  console.log(1);
}
```

* * *

`if`-`else` example:
```js
if (def('ONE')) { // #if
  console.info('IF branch');
} else {  // #else ONE
  console.info('ELSE branch');
}         // #eend ONE
```

transforms to:
```js
{
  console.info('IF branch');
}
```

* * *

nested ifdefs are also allowed:
```js
if (def('ONE')) { // #if
  console.log('one');

  if (def('TWO')) { // #if
    console.log('two');
  } // #end TWO

} // #end ONE


if (def('TWO')) { // #if
  console.log('222');

  if (def('ONE')) { // #if
    console.log('111');
  } // #end ONE

} // #end TWO
```

transforms to:
```js
{
  console.log('one');
}
```

But you can't use the same define nested (e.g. `if (def('ONE')) { … if (def('ONE')… }`), it will throw an error.

* * *

The following special comments are detected:
1. `if (def('SOME')) {   // #if`: start of `SOME` section, `'` and `{` on the same line required for detection;
2. `}   // #end SOME`: put comment on the same line with `}` and put definention name after `#end`;
3. `} else { // #else SOME`: `}`, `else`, `{` and comment are on the same line, definition name (`SOME`) included;
4. `}   // #eend SOME`: same as `#end`, but for `if`-`else` we use `#eend`.

* * *

The original `// #ifdef … // #endif` syntax also works.

### Fork caveats
If you use **nested conditions** and create `map`-file using MagicString (not sure it's possible now), MagicString will produce bad map, 
because nested conditions require several MagicString passes. and map uses only the last pass source code, which is already pre-processed.


### Original description
```js
import { rollup } from 'rollup'
import replace from 'rollup-plugin-ifdef'
import commonjs from 'rollup-plugin-commonjs'
rollup({
  entry: 'main.js',
  plugins: [
    replace({
      // ... do replace before commonjs
      patterns: [
        {
          // regexp match with resolved path
          match: /formidable(\/|\\)lib/, 
          // string or regexp
          test: 'if (global.GENTLY) require = GENTLY.hijack(require);', 
          // string or function to replaced with
          replace: '',
        }
      ]
    }),
    commonjs(),
    replace({
       // ... do replace after commonjs
    })
  ]
}).then(...)
```

## Define macro pre-processor 

use `defines` options to remove macro blocks

### Options
```javascript
{
  defines: {
    IS_SKIP: false,
    IS_REMOVE: true,
  }
}
```

### input
```javascript
// #if IS_SKIP
  console.log('!Skip!')
// #endif
// #if IS_REMOVE
console.log('!Remove!')
// #endif
```

### output
```javascript
// #if IS_SKIP
  console.log('!Skip!')
// #endif
```


## Replace

use `replaces` options to quick replace text

### Options
```javascript
{
  replaces: {
    $version: "1.0.1"
  }
}
```

### input
```javascript
  console.log('$version')
```

### output
```javascript
  console.log('1.0.1')
```


## Options

```javascript
{
  // a minimatch pattern, or array of patterns, of files that
  // should be processed by this plugin (if omitted, all files
  // are included by default)...
  include: 'config.js',

  // ...and those that shouldn't, if `include` is otherwise
  // too permissive
  exclude: 'node_modules/**',
  defines: {
    IS_SKIP: false,
    IS_REMOVE: true,
  },
  replaces: {
    $version: "1.0.1"
  },
  patterns: [
    {
      include: [], // same as above
      exclude: [], // same as above
      // regexp match with resolved path
      match: /formidable(\/|\\)lib/, 
      // string or regexp
      test: 'if (global.GENTLY) require = GENTLY.hijack(require);', 
      // string or function
      replace: '',
    },
    // replace whole file content
    {
      text: 'exports = "content"', // replace content with given text
    },
    {
      file: './replace.js', // replace with given relative file
    },
    {
      transform (code, id) { // replace by function
        return `'use strict';\n${code}`
      }
    }
  ]
}
```
