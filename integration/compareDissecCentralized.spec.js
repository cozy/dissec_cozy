const util = require('util')
const exec = util.promisify(require('child_process').exec)
const { Q } = require('cozy-client')

const populateInstances = require('../scripts/populateInstances')
const dissecLearning = require('../scripts/learning/dissecLearning')
const localLearning = require('../scripts/learning/localLearning')
const getClient = require('../src/lib/getClient')
const { BANK_OPERATIONS_DOCTYPE } = require('../src/doctypes')
const { createLogger } = require('../src/targets/services/helpers')

// NOTE: This assumes that the current classes and vocabulary
describe('Compares the performance of a centralized learning vs the DISSEC one', () => {
  const defaultTimeout = 300000
  const { log } = createLogger('integration')

  const uri = 'http://test1.localhost:8080'
  let client
  let token
  let operations = []
  let validationSet = []
  let categories = []
  let cutoffDate

  beforeAll(async () => {
    await populateInstances({
      nInstances: 5,
      operationsPerInstance: 2,
      fixtureFile: './assets/fixtures-s.json'
    })

    const { stdout } = await exec(
      `cozy-stack instances token-app ${uri.replace('http://', '')} dissecozy`
    )
    token = stdout.toString().replace('\n', '')

    // Helper
    const getCategory = doc => {
      return doc.manualCategoryId || doc.localCategoryId || doc.cozyCategoryId
    }

    // Connect to the instance
    const schema = {
      operations: {
        doctype: BANK_OPERATIONS_DOCTYPE,
        attributes: {},
        relationships: {}
      }
    }
    client = await getClient(uri, schema, { token })

    // Download all bank operations
    operations = await client.queryAll(
      Q(BANK_OPERATIONS_DOCTYPE)
        .where({ date: { $gt: null } })
        .sortBy([{ date: 'asc' }])
        .indexFields(['date'])
    )

    log(`Local instance has ${operations.length} data`)

    // Filter and update data
    const allCategories = operations.map(e => getCategory(e))
    categories = []
    allCategories.forEach(e => !categories.includes(e) && categories.push(e))

    // Since data in the set are not modified during the execution, the validation set is just a reference to the training set
    validationSet = operations
    cutoffDate = new Date(validationSet[validationSet.length - 1].date)

    log(
      `Training on ${operations.length -
        validationSet.length} data, validating on ${validationSet.length}`
    )
  }, defaultTimeout)

  test(
    'Local training is worst because it uses less data',
    async () => {
      const local = await localLearning({
        client,
        cutoffDate,
        validationSet,
        useTiny: true
      })
      const dissec = await dissecLearning({
        client,
        cutoffDate,
        validationSet,
        useTiny: true
      })

      log('Local', local)
      log('Dissec', dissec)
      expect(local).toEqual(0.5)
      expect(dissec).toEqual(1)
    },
    defaultTimeout
  )

  test(
    'Training locally equals the dissec training when they have the same data',
    async () => {
      const local = await localLearning({
        client,
        validationSet,
        useTiny: true
      })
      const dissec = await dissecLearning({
        client,
        validationSet,
        useTiny: true
      })

      log('Local', local)
      log('Dissec', dissec)
      expect(local).toEqual(1)
      expect(dissec).toEqual(1)
    },
    defaultTimeout
  )
})
