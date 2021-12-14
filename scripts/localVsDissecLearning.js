const fs = require('fs')
const { v4: uuid } = require('uuid')
const {
  default: CozyClient,
  createClientInteractive,
  Q
} = require('cozy-client')

const { BANK_DOCTYPE } = require('../src/doctypes/bank')
const { JOBS_DOCTYPE } = require('../src/doctypes/jobs')
const { NODES_DOCTYPE } = require('../src/doctypes/nodes')
const { PERFORMANCES_DOCTYPE } = require('../src/doctypes/performances')
const dissecConfig = require('../dissec.config.json')

const aggregationNodes = require('../assets/webhooks.json')
const { exit } = require('process')

/**
 * This script measures performances of DISSEC vs local learning.
 *
 * It supposes that the querier instance has at least 2 categories of bank operations.
 */

const runExperiment = async () => {
  const uri = process.argv[2]
  if (!uri)
    throw new Error('Expected the URI of the executing instance as parameter')

  // Helper
  const getCategory = doc => {
    return doc.manualCategoryId || doc.localCategoryId || doc.cozyCategoryId
  }

  // Connect to the instance
  const client = await createClientInteractive({
    scope: [BANK_DOCTYPE, JOBS_DOCTYPE],
    uri: process.argv[2],
    schema: {
      operations: {
        doctype: BANK_DOCTYPE,
        attributes: {},
        relationships: {}
      }
    },
    oauth: {
      softwareID: 'io.cozy.client.cli'
    }
  })

  // Download all bank operations
  const allOperations = await client.queryAll(Q(BANK_DOCTYPE))

  // Filter and update data
  const allCategories = allOperations.map(e => getCategory(e))
  const uniqueCategories = []
  allCategories.forEach(
    e => !uniqueCategories.includes(e) && uniqueCategories.push(e)
  )

  const sortedOperations = allOperations.sort(
    (a, b) =>
      new Date(a.cozyMetadata.createdAt).valueOf() -
      new Date(b.cozyMetadata.createdAt).valueOf()
  )
  const cutoffDate = new Date(
    sortedOperations[
      Math.round(sortedOperations.length / 2)
    ].cozyMetadata.createdAt
  )
  const validationSet = sortedOperations
    .filter(
      e =>
        cutoffDate.valueOf() - new Date(e.cozyMetadata.createdAt).valueOf() > 0
    )
    .sort((a, b) => a.id - b.id)
  const validationIds = validationSet.map(e => e.id)

  /** ===== LOCAL TRAINING ===== **/
  const { data: localTrainingJob } = await client
    .collection(JOBS_DOCTYPE)
    .create('service', {
      slug: 'dissecozy',
      name: 'categorize',
      pretrained: false,
      filters: {
        date: cutoffDate
      }
    })

  const jobData = await client
    .collection(JOBS_DOCTYPE)
    .waitFor(localTrainingJob.id)

  if (jobData.state !== 'done')
    throw new Error(
      'Local training finished with invalid status:' + jobData.state
    )

  // Measure performance
  const locallyTrainedOperations = await client.queryAll(Q(BANK_DOCTYPE))
  const locallyTrainedValidationSet = locallyTrainedOperations
    .filter(e => validationIds.includes(e.id))
    .sort((a, b) => a.id - b.id)

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
  // Create the tree
  // TODO: Make a dynamic tree
  const querierWebhooks = aggregationNodes.filter(e => e.label === uri)[0]
  const aggregatorsWebhooks = aggregationNodes.filter(e => e.label !== uri)
  let querier = {
    webhook: querierWebhooks.aggregationWebhook,
    level: 0,
    nbChild: 3,
    aggregatorId: uuid(),
    finalize: true
  }

  let aggregators = [
    {
      webhook: aggregatorsWebhooks[0].aggregationWebhook,
      level: 1,
      nbChild: 6,
      parent: querier,
      aggregatorId: uuid(),
      finalize: false
    },
    {
      webhook: aggregatorsWebhooks[1].aggregationWebhook,
      level: 1,
      nbChild: 6,
      parent: querier,
      aggregatorId: uuid(),
      finalize: false
    },
    {
      webhook: aggregatorsWebhooks[2].aggregationWebhook,
      level: 1,
      nbChild: 6,
      parent: querier,
      aggregatorId: uuid(),
      finalize: false
    }
  ]

  // All instances with data will contribute
  let contributors = aggregatorsWebhooks.map(e => ({
    ...e,
    level: 2,
    nbChild: 0,
    parents: aggregators
  }))

  const executionId = uuid()

  // Triggering contributions
  for (const contributor of contributors) {
    const contributionBody = {
      executionId,
      pretrained: false,
      nbShares: 3,
      parents: contributor.parents,
      filters: contributor
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
  fs.watchFile(dissecConfig.localModelPath, async () => {
    console.log('Model has been updated')
    // Using the model to classify
    const { data: dissecTrainingJob } = await client
      .collection(JOBS_DOCTYPE)
      .create('service', {
        slug: 'dissecozy',
        name: 'categorize',
        pretrained: true,
        filters: {
          date: cutoffDate
        }
      })

    const jobData = await client
      .collection(JOBS_DOCTYPE)
      .waitFor(dissecTrainingJob.id)

    if (jobData.state !== 'done')
      throw new Error(
        'DISSEC training finished with invalid status:' + jobData.state
      )

    // Measure performance
    const dissecTrainedOperations = await client.queryAll(Q(BANK_DOCTYPE))
    const dissecTrainedValidationSet = dissecTrainedOperations
      .filter(e => validationIds.includes(e.id))
      .sort((a, b) => a.id - b.id)

    // Both array are sorted and contain the same elements
    let correct = 0
    for (let i = 0; i < validationSet.length; i++) {
      const truth = getCategory(validationSet[i])
      const prediction = dissecTrainedValidationSet[i].automaticCategoryId

      if (truth === prediction) correct++
    }

    let localAccuracy = correct / validationSet.length

    console.log('DISSEC accuracy', localAccuracy)
    exit(0)
  })
}

runExperiment()

module.exports = {
  runExperiment
}
