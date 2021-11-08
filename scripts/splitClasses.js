const fs = require('fs')

const classes = JSON.parse(
  fs.readFileSync('../src/assets/classes.json').toString()
)

/**
 * Splits the category labels between a given number of instances.
 * 
 * If there more instances than categories, categories are cyclically reused.
 */
const main = () => {
  const nInstances = process.argv[3] || 1
  const current = process.argv[2] || nInstances
  const nClasses = process.argv[4] || 1

  let keys = Object.keys(classes)

  const keysUsed = nInstances * nClasses

  let result = []
  for(let i=0; i<nClasses; i++) {
    result.push(keys[((current - 1) * nClasses + i) % keys.length])
  }

  console.log(result.join(','))
}

main()
