global.fetch = require('node-fetch').default
const fs = require('fs')
const { v4: uuid } = require('uuid')
const { Q } = require('cozy-client')

const createTree = require('../../src/lib/createTree')
const getCategory = require('../../src/lib/getCategory')
const { BANK_DOCTYPE } = require('../../src/doctypes/bank')
const { JOBS_DOCTYPE } = require('../../src/doctypes/jobs')
const dissecConfig = require('../../dissec.config.json')

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

const dissecLearning = async (
  client,
  cutoffDate,
  validationSet,
  uri = 'http://test1.localhost:8080'
) => {
  // Create the tree, exclude the querier from contributors and aggregators
  const aggregationNodes = JSON.parse(
    fs.readFileSync(`${process.cwd()}/assets/webhooks.json`).toString()
  )
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
  return await new Promise(async resolve => {
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
      const validationIds = validationSet.map(e => e.id)
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

      fs.unwatchFile(dissecConfig.localModelPath)

      resolve(correct / validationSet.length)
    })
  })
}

module.exports = dissecLearning
