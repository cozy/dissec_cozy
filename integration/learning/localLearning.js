global.fetch = require('node-fetch').default
const { Q } = require('cozy-client')

const getCategory = require('../../src/lib/getCategory')
const { BANK_DOCTYPE } = require('../../src/doctypes/bank')
const { JOBS_DOCTYPE } = require('../../src/doctypes/jobs')

/**
 *
 * @param {CozyClient} client - The CozyClient connected to the instance
 * @param {Date} cutoffDate - Data older than this will be used to learn
 * @param {Object[]} validationSet - The dataset used for measuring performances
 * @returns The accuracy of the model on the validation set
 */
const localLearning = async (client, cutoffDate, validationSet) => {
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
