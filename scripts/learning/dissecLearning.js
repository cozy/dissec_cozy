global.fetch = require('node-fetch').default
const fs = require('fs')
const { v4: uuid } = require('uuid')
const { Q } = require('cozy-client')

const createTree = require('../../src/lib/createTree')
const getCategory = require('../../src/lib/getCategory')
const dissecConfig = require('../../dissec.config.json')
const { createLogger } = require('../../src/targets/services/helpers/utils')

// FIXME: export doc type for CommonJS
const BANK_OPERATIONS_DOCTYPE = 'io.cozy.bank.operations'
const JOBS_DOCTYPE = 'io.cozy.jobs'

/**
 * @typedef TreeLevelDescriptor
 * @type {object}
 * @property {number} numberOfNodes - The number of nodes in the level
 * @property {string[] | undefined} mustInclude - An optional array of instance URIs that need to be included in the level
 */

/**
 * @typedef DissecLearningOptions
 * @type {object}
 * @property {CozyClient} client - The CozyClient connected to the instance
 * @property {Date} cutoffDate - Data older than this will be used to learn
 * @property {Object[]} validationSet - The dataset used for measuring performances
 * @property {string} uri - URI of the final aggregator
 * @property {boolean} pretrained - Whether we are using the pretrained local model
 * @property {TreeLevelDescriptor[]} treeStructure - An array describing each levels of the tree.
 * @property {boolean} useTiny - Whether to use the tiny version of classes and vocabulary
 */

/**
 * Measures performance on the validation set with a model trained on all data earlier than cutoffDate.
 * All the instances populated (have their webhooks in the asset folder) are contributing.
 *
 * @param {DissecLearningOptions}
 * @returns The accuracy of the model on the validation set
 */
const dissecLearning = async ({
  client,
  cutoffDate,
  validationSet,
  pretrained = false,
  treeStructure = { depth: 3, fanout: 2, groupSize: 2 },
  useTiny = true
}) => {
  const { log } = createLogger('learning/dissec')

  // Create the tree, exclude the querier from contributors and aggregators
  const aggregationNodes = JSON.parse(
    fs.readFileSync(`${process.cwd()}/generated/webhooks.json`).toString()
  )

  const contributors = createTree(treeStructure, aggregationNodes)
  const executionId = uuid()

  /**
   * The way DISSEC works currently, contributors do their local computations before passing the aggregate to their parents.
   * Contributors know the whole tree's structure and pass it to aggregators upon contributing.
   * To run DISSEC, we thus only trigger contributors by indicating their parents.
   */
  for (const contributor of contributors) {
    const contributionBody = {
      executionId,
      pretrained,
      treeStructure,
      parents: contributor.parents,
      useTiny
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
  log('DISSEC aggregation started, waiting for it to finish...')
  return await new Promise(async resolve => {
    fs.watchFile(dissecConfig.localModelPath, async (curr, prev) => {
      if (!curr.ctimeMs) {
        // The model was just created, this event is only the creation of the file with no content.
        // Wait for writing to finish
        return
      }
      if (curr.ctimeMs <= prev.ctimeMs) {
        throw new Error('Updating the model failed')
      }

      log('Model has been updated')
      // Using the model to classify
      const { data: dissecTrainingJob } = await client
        .collection(JOBS_DOCTYPE)
        .create('service', {
          slug: 'dissecozy',
          name: 'categorize',
          pretrained: true,
          useTiny,
          filters: {
            minOperationDate: cutoffDate
          }
        })

      log('Waiting for the local categorization to finish...')
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
        Q(BANK_OPERATIONS_DOCTYPE)
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
