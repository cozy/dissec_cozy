global.fetch = require('node-fetch').default
const { Q } = require('cozy-client')
const { execSync } = require('child_process')
const { BANK_DOCTYPE } = require('../src/doctypes/bank')
const getClient = require('../src/lib/getClient')
const { createLogger } = require('../src/targets/services/helpers/utils')
const localLearning = require('./learning/localLearning')
const dissecLearning = require('./learning/dissecLearning')

/**
 * This script measures performances of DISSEC vs local learning.
 *
 * The local instance's dataset is split into a training set and a validation set.
 * First, a prediction model is trained using only the training set.
 * The script makes prediction on the validation set and accuracy is then computed.
 * Then, a model is trained using the training set plus datasets of other instance using a DISSEC training.
 * The resulting model is used to generate predictions on the validation set.
 * Both result can then be meaningfully compared, as they result from predictions on the same validation set.
 *
 * @param {string} uri The URI of the local instance
 * @param {boolean} noSplit - True will create exclusive test and validation datasets
 */

const runExperiment = async (
  uri = 'http://test1.localhost:8080',
  noSplit = false
) => {
  if (!uri)
    throw new Error('Expected the URI of the executing instance as parameter')

  const token = execSync(
    `cozy-stack instances token-app ${uri.replace('http://', '')} dissecozy`
  )
    .toString()
    .replace('\n', '')

  const { log } = createLogger()

  // Helper
  const getCategory = doc => {
    return doc.manualCategoryId || doc.localCategoryId || doc.cozyCategoryId
  }

  // Connect to the instance
  const schema = {
    operations: {
      doctype: BANK_DOCTYPE,
      attributes: {},
      relationships: {}
    }
  }
  const client = await getClient(uri, schema, { token })

  // Download all bank operations
  const sortedOperations = await client.queryAll(
    Q(BANK_DOCTYPE)
      .where({ date: { $gt: null } })
      .sortBy([{ date: 'asc' }])
      .indexFields(['date'])
  )

  log(`Local instance has ${sortedOperations.length} data`)

  // Filter and update data
  const allCategories = sortedOperations.map(e => getCategory(e))
  const uniqueCategories = []
  allCategories.forEach(
    e => !uniqueCategories.includes(e) && uniqueCategories.push(e)
  )

  // Since data in the set are not modified during the execution, the validation set is just a reference to the training set
  const validationSet = noSplit
    ? sortedOperations
    : sortedOperations.slice(Math.round(sortedOperations.length / 2))
  const cutoffDate = noSplit
    ? new Date(validationSet[validationSet.length - 1].date)
    : new Date(validationSet[0].date)

  log(
    `Training on ${sortedOperations.length -
      validationSet.length} data, validating on ${validationSet.length}`
  )

  /** ===== LOCAL TRAINING ===== **/
  let localAccuracy = await localLearning({
    client,
    cutoffDate,
    validationSet,
    useTiny: true
  })

  log('Local accuracy', localAccuracy)

  /** ===== DISSEC TRAINING ===== **/
  let dissecAccuracy = await dissecLearning({
    client,
    cutoffDate,
    validationSet,
    uri,
    useTiny: true
  })

  log('DISSEC accuracy', dissecAccuracy)
}

runExperiment(process.argv[2], process.argv[3], process.argv[4])

module.exports = {
  runExperiment
}
