const { execSync } = require('child_process')
const {
  default: CozyClient,
  createClientInteractive,
  Q
} = require('cozy-client')

const { populateCentralized } = require('../scripts/populateCentralized')
const { dissecLearning } = require('./helpers/dissecLearning')
const { localLearning } = require('./helpers/localLearning')
const { BANK_DOCTYPE } = require('../src/doctypes/bank')
const { JOBS_DOCTYPE } = require('../src/doctypes/jobs')

describe('Compares the performance of a centralized learning vs the DISSEC one', () => {
  const defaultTimeout = 150000

  const uri = 'http://test1.localhost:8080'
  let client
  let token
  let operations = []
  let validationSet = []
  let categories = []
  let cutoffDate

  beforeAll(async () => {
    await populateCentralized()

    token = execSync(
      `cozy-stack instances token-app ${uri.replace('http://', '')} dissecozy`
    )
      .toString()
      .replace('\n', '')

    // Helper
    const getCategory = doc => {
      return doc.manualCategoryId || doc.localCategoryId || doc.cozyCategoryId
    }

    // Connect to the instance
    client = await (async () => {
      const schema = {
        operations: {
          doctype: BANK_DOCTYPE,
          attributes: {},
          relationships: {}
        }
      }
      if (token) {
        return new CozyClient({
          uri,
          schema,
          token: token
        })
      } else {
        return await createClientInteractive({
          scope: [BANK_DOCTYPE, JOBS_DOCTYPE],
          uri,
          schema,
          oauth: {
            softwareID: 'io.cozy.client.cli'
          }
        })
      }
    })()

    // Download all bank operations
    operations = await client.queryAll(
      Q(BANK_DOCTYPE)
        .where({ date: { $gt: null } })
        .sortBy([{ date: 'asc' }])
        .indexFields(['date'])
    )

    console.log(`Local instance has ${operations.length} data`)

    // Filter and update data
    const allCategories = operations.map(e => getCategory(e))
    categories = []
    allCategories.forEach(e => !categories.includes(e) && categories.push(e))

    // Since data in the set are not modified during the execution, the validation set is just a reference to the training set
    validationSet = operations
    cutoffDate = new Date(validationSet[validationSet.length - 1].date)

    console.log(
      `Training on ${operations.length -
        validationSet.length} data, validating on ${validationSet.length}`
    )
  }, defaultTimeout)

  test(
    'Both trainings must have equal accuracy',
    async () => {
      const local = await localLearning(client, cutoffDate, validationSet)
      const dissec = await dissecLearning(client, cutoffDate, validationSet)

      expect(local).toEqual(dissec)
    },
    defaultTimeout
  )
})
