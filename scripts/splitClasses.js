const fs = require('fs')

const classes = JSON.parse(
  fs.readFileSync('./src/assets/classes.json').toString()
)

/**
 * Splits the category labels between a given number of instances.
 *
 * If there more instances than categories, categories are cyclically reused.
 */
export const splitClasses = (nInstances, nClassesPerInstance) => {
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
}

splitClasses(process.argv[2] || 1, process.argv[3] || 1)
