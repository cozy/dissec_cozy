const fs = require('fs')

const classes = JSON.parse(
  fs.readFileSync('./src/assets/classes.json').toString()
)

/**
 * Splits the category labels between a given number of instances.
 *
 * If there more instances than categories, categories are cyclically reused.
 */
const splitClasses = (
  nInstances = 1,
  nClassesPerInstance = 1,
  allClasses = Object.keys(classes)
) => {
  const result = []
  for (let current = 1; current <= nInstances; current++) {
    const instanceResult = []
    for (let i = 0; i < nClassesPerInstance; i++) {
      instanceResult.push(
        allClasses[
          ((current - 1) * nClassesPerInstance + i) % allClasses.length
        ]
      )
    }
    result.push(instanceResult.join(','))
  }

  // TODO: Clearer log / remove log
  // Logging the result to get it when using `exec`
  console.log(result.join(' '))

  return result
}

module.exports = splitClasses
