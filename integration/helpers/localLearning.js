global.fetch = require('node-fetch').default
const { Q } = require('cozy-client')

const { BANK_DOCTYPE } = require('../../src/doctypes/bank')
const { JOBS_DOCTYPE } = require('../../src/doctypes/jobs')
const { getCategory } = require('./getCategory')

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

module.exports = {
  localLearning
}
