
function def (x) {
  return {
    YES: true,
    TWO: true
  }[x]
}

if (def('YES')) { // #if
  console.log('!yes!')
} // #end YES

if (def('NO')) { // #if
  console.log('!no!')
}// #end NO

if (def('YES')) { // #if
  console.log('!yes2!')
} else { // #else YES
  console.log('!not yes2!')
} // #eend YES

if (def('NO')) { // #if
  console.log('!no2!')
} else { // #else NO
  console.log('!not no2!')
}// #eend NO

if (def('ONE')) { // #if
  console.log('!one!')
  if (def('TWO')) { // #if
    console.log('!two!')
  } // #end TWO
} // #end ONE

if (def('TWO')) { // #if
  console.log('!two2!')
  if (def('ONE')) { // #if
    console.log('!one2!')
  } // #end ONE
} // #end TWO

if (def('YES')) { // #if
  console.log('!yes3!')
  if (def('TWO')) { // #if
    console.log('!two3!')
    if (def('ONE')) { // #if
      console.log('!one3!')
    } else { // #else ONE
      console.log('!three!')
    }// #eend ONE
  } // #end TWO
} // #end YES
