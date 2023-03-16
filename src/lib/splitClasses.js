const fs = require('fs')

const classes = JSON.parse(
  fs.readFileSync('./src/assets/classes.json').toString()
)

/**
 * Splits the category labels between a given number of instances.
 *
 * If there more instances than categories, categories are cyclically reused.
 */
const splitClasses = (nInstances = 1, nClassesPerInstance = 1) => {
  let keys = Object.keys(classes)

  const result = []
  for (let current = 1; current <= nInstances; current++) {
    const instanceResult = []
    for (let i = 0; i < nClassesPerInstance; i++) {
      instanceResult.push(
        keys[((current - 1) * nClassesPerInstance + i) % keys.length]
      )
    }
    result.push(instanceResult.join(','))
  }

  console.log(result.join(' '))

  return result
}

module.exports = splitClasses
