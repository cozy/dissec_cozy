global.fetch = require('node-fetch').default
const fs = require('fs')
const { v4: uuid } = require('uuid')
const { Q } = require('cozy-client')
const { execSync } = require('child_process')
const { BANK_DOCTYPE } = require('../src/doctypes/bank')
const { JOBS_DOCTYPE } = require('../src/doctypes/jobs')
const dissecConfig = require('../dissec.config.json')

const aggregationNodes = require('../assets/webhooks.json')
const createTree = require('../src/lib/createTree')
const getClient = require('../src/lib/getClient')

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

  console.log(`Local instance has ${sortedOperations.length} data`)

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
  const validationIds = validationSet.map(e => e.id)

  console.log(
    `Training on ${sortedOperations.length -
      validationSet.length} data, validating on ${validationSet.length}`
  )

  /** ===== LOCAL TRAINING ===== **/
  const { data: localTrainingJob } = await client
    .collection(JOBS_DOCTYPE)
    .create('service', {
      slug: 'dissecozy',
      name: 'categorize',
      pretrained: false,
      filters: {
        minOperationDate: cutoffDate
      }
    })

  console.log('Waiting for the local categorization to finish...')
  const jobData = await client
    .collection(JOBS_DOCTYPE)
    .waitFor(localTrainingJob.id)

  if (jobData.state !== 'done')
    throw new Error(
      'Local training finished with invalid status:' + jobData.state
    )

  // Measure performance
  const locallyTrainedValidationSet = await client.queryAll(
    Q(BANK_DOCTYPE)
      .getByIds(validationIds)
      .sortBy([{ date: 'asc' }])
      .indexFields(['date'])
  )

  // Both array are sorted and contain the same elements
  let correct = 0
  for (let i = 0; i < validationSet.length; i++) {
    const truth = getCategory(validationSet[i])
    const prediction = locallyTrainedValidationSet[i].automaticCategoryId

    if (truth === prediction) correct++
  }

  let localAccuracy = correct / validationSet.length

  console.log('Local accuracy', localAccuracy)

  /** ===== DISSEC TRAINING ===== **/
  // Create the tree, exclude the querier from contributors and aggregators
  const querierWebhooks = aggregationNodes.filter(e => e.label === uri)[0]
  const aggregatorsWebhooks = aggregationNodes.filter(e => e.label !== uri)
  const contributorsWebhooks = aggregatorsWebhooks

  const contributors = createTree(
    querierWebhooks,
    aggregatorsWebhooks,
    contributorsWebhooks
  )
  const executionId = uuid()

  /**
   * The way DISSEC works currently, contributors do their local computations before passing the aggregate to their parents.
   * Contributors know the whole tree's structure and pass it to aggregators upon contributing.
   * To run DISSEC, we thus only trigger contributors by indicating their parents.
   */
  for (const contributor of contributors) {
    const contributionBody = {
      executionId,
      pretrained: false,
      nbShares: 3,
      parents: contributor.parents
    }
    await new Promise(resolve => {
      setTimeout(resolve, 1000)
    })
    await client.stackClient.fetchJSON(
      'POST',
      contributor.contributionWebhook,
      contributionBody
    )
  }

  // Watching for update on the model
  console.log('DISSEC aggregation started, waiting for it to finish...')
  fs.watchFile(dissecConfig.localModelPath, async (curr, prev) => {
    if (curr.ctime <= prev.ctime) {
      throw new Error('Updating the model failed')
    }

    console.log('Model has been updated')
    // Using the model to classify
    const { data: dissecTrainingJob } = await client
      .collection(JOBS_DOCTYPE)
      .create('service', {
        slug: 'dissecozy',
        name: 'categorize',
        pretrained: true,
        filters: {
          minOperationDate: cutoffDate
        }
      })

    console.log('Waiting for the local categorization to finish...')
    const jobData = await client
      .collection(JOBS_DOCTYPE)
      .waitFor(dissecTrainingJob.id)

    if (jobData.state !== 'done')
      throw new Error(
        'DISSEC training finished with invalid status:' + jobData.state
      )

    // Measure performance
    const dissecTrainedValidationSet = await client.queryAll(
      Q(BANK_DOCTYPE)
        .getByIds(validationIds)
        .sortBy([{ date: 'asc' }])
    )

    // Both array are sorted and contain the same elements
    let correct = 0
    for (let i = 0; i < validationSet.length; i++) {
      const truth = getCategory(validationSet[i])
      const prediction = dissecTrainedValidationSet[i].automaticCategoryId

      if (truth === prediction) correct++
    }

    let localAccuracy = correct / validationSet.length

    console.log('DISSEC accuracy', localAccuracy)
    fs.unwatchFile(dissecConfig.localModelPath)
  })
}

runExperiment(process.argv[2], process.argv[3], process.argv[4])

module.exports = {
  runExperiment
}
