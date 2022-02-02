const { execSync } = require('child_process')
const { Q } = require('cozy-client')

const populateCentralized = require('../scripts/populateCentralized')
const dissecLearning = require('./learning/dissecLearning')
const localLearning = require('./learning/localLearning')
const getClient = require('../src/lib/getClient')
const { BANK_DOCTYPE } = require('../src/doctypes/bank')

describe('Compares the performance of a centralized learning vs the DISSEC one', () => {
  const defaultTimeout = 300000

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
    const schema = {
      operations: {
        doctype: BANK_DOCTYPE,
        attributes: {},
        relationships: {}
      }
    }
    client = await getClient(uri, schema, { token })
    console.log(client)

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
