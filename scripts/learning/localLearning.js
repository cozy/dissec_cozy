global.fetch = require('node-fetch').default
const { Q } = require('cozy-client')

const getCategory = require('../../src/lib/getCategory')
const { BANK_DOCTYPE } = require('../../src/doctypes')
const { JOBS_DOCTYPE } = require('../../src/doctypes')
const { createLogger } = require('../../src/targets/services/helpers/utils')

/**
 * @typedef LocalLearningOptions
 * @type {object}
 * @property {CozyClient} client - The CozyClient connected to the instance
 * @property {Date} cutoffDate - Data older than this will be used to learn
 * @property {Object[]} validationSet - The dataset used for measuring performances
 * @property {Object[]} pretrained - The dataset used for measuring performances
 * @property {boolean} useTiny - Whether to use the tiny version of classes and vocabulary
 */

/**
 * Measures performance on the validation set with a model trained on all data earlier than cutoffDate
 * @param {LocalLearningOptions} options - Local learning options
 * @returns The accuracy of the model on the validation set
 */
const localLearning = async ({
  client,
  cutoffDate,
  validationSet,
  pretrained,
  useTiny
}) => {
  const { log } = createLogger('learning/local')

  log('starting local training')
  const { data: localTrainingJob } = await client
    .collection(JOBS_DOCTYPE)
    .create('service', {
      slug: 'dissecozy',
      name: 'categorize',
      pretrained,
      useTiny,
      filters: {
        minOperationDate: cutoffDate
      }
    })

  log('Waiting for the local categorization to finish...')
  const jobData = await client
    .collection(JOBS_DOCTYPE)
    .waitFor(localTrainingJob.id)

  if (jobData.state !== 'done')
    throw new Error(
      'Local training finished with invalid status:' + jobData.state
    )

  // Measure performance
  const validationIds = validationSet.map(e => e.id)
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

  return correct / validationSet.length
}

module.exports = localLearning
