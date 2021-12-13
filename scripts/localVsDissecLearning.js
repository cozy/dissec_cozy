const fs = require('fs')
const {
  default: CozyClient,
  createClientInteractive,
  Q
} = require('cozy-client')

const { BANK_DOCTYPE } = require('../src/doctypes/bank')
const { JOBS_DOCTYPE } = require('../src/doctypes/jobs')
const { NODES_DOCTYPE } = require('../src/doctypes/nodes')
const { PERFORMANCES_DOCTYPE } = require('../src/doctypes/performances')

const aggregationNodes = require('../assets/webhooks.json')

/**
 * This script measures performances of DISSEC vs local learning.
 *
 * It supposes that the querier instance has at least 2 categories of bank operations.
 */

const runExperiment = async () => {
  const uri = process.argv[2]
  if (!uri)
    throw new Error('Expected the URI of the executing instance as parameter')

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
  const allCategories = allOperations.map(
    e => e.manualCategoryId || e.localCategoryId || e.cozyCategoryId
  )
  const uniqueCategories = []
  allCategories.forEach(
    e => !uniqueCategories.includes(e) && uniqueCategories.push(e)
  )

  const sortedOperations = allOperations.sort(
    (a, b) =>
      new Date(a.cozyMetadata.updatedAt).valueOf() -
      new Date(b.cozyMetadata.updatedAt).valueOf()
  )
  const cutoffDate = new Date(
    sortedOperations[
      Math.round(sortedOperations.length / 2)
    ].cozyMetadata.updatedAt
  )
  const validationSet = sortedOperations.filter(
    e => cutoffDate.valueOf() - new Date(e.cozyMetadata.updatedAt).valueOf() > 0
  )

  // Local learning
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
    throw new Error('Job finished with invalid status:' + jobData.state)

  // Measure performance
  const validationIds = validationSet.map(e => e.id)

  const locallyTrainedOperations = await client.queryAll(Q(BANK_DOCTYPE))
  const locallyTrainedValidationSet = locallyTrainedOperations.filter(e =>
    validationIds.includes(e.id)
  )
  locallyTrainedValidationSet.sort((a, b) => a.id - b.id)

  // Both array are sorted and contain the same elements
  const getCategory = doc => {
    return doc.manualCategoryId || doc.localCategoryId || doc.cozyCategoryId
  }

  let correct = 0
  for (let i = 0; i < validationSet.length; i++) {
    const truth = getCategory(validationSet[i])
    const prediction = getCategory(locallyTrainedValidationSet[i])

    if (truth === prediction) correct++
  }

  let localAccuracy = correct / validationSet.length

  console.log('Local accuracy', localAccuracy)

  // DISSEC learning
  
  // Compare performances
  // Create performance document
}

runExperiment()

module.exports = {
  runExperiment
}
