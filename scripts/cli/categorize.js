const { program } = require('commander')
const { Q } = require('cozy-client')
const { execSync } = require('child_process')
const { BANK_DOCTYPE } = require('../../src/doctypes/bank')
const getClient = require('../../src/lib/getClient')
const { createLogger } = require('../../src/targets/services/helpers/utils')
const localLearning = require('../learning/localLearning')

program
  .option(
    '-s, --split',
    'Split the data in half, train on the first and validate on the second'
  )
  .option(
    '-d, --domain',
    'Domain of the instance supervising the protocol',
    'test1.localhost:8080'
  )
  .option('-p, --pretrained', 'Whether to use an existing pretrainend model')

program.parse()

const options = program.opts()

async function main() {
  if (!options.domain)
    throw new Error('Expected the URI of the executing instance as parameter')

  const uri = 'http://' + options.domain

  const token = execSync(
    `cozy-stack instances token-app ${options.domain} dissecozy`
  )
    .toString()
    .replace('\n', '')

  const { log } = createLogger('cli/categorize')

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
  const client = await getClient(uri, schema, { token })

  // Download all bank operations
  const sortedOperations = await client.queryAll(
    Q(BANK_DOCTYPE)
      .where({ date: { $gt: null } })
      .sortBy([{ date: 'asc' }])
      .indexFields(['date'])
  )

  log(`Local instance has ${sortedOperations.length} data`)

  // Filter and update data
  const allCategories = sortedOperations.map(e => getCategory(e))
  const uniqueCategories = []
  allCategories.forEach(
    e => !uniqueCategories.includes(e) && uniqueCategories.push(e)
  )

  // Since data in the set are not modified during the execution, the validation set is just a reference to the training set
  const validationSet = options.split
    ? sortedOperations.slice(Math.round(sortedOperations.length / 2))
    : sortedOperations
  const cutoffDate = options.split ? new Date(validationSet[0].date) : undefined

  log(
    `Training on ${
      options.split
        ? sortedOperations.length - validationSet.length
        : sortedOperations.length
    } data, validating on ${validationSet.length}`
  )
  const accuracy = await localLearning({
    client,
    cutoffDate,
    validationSet,
    uri: options.supervisor,
    pretrained: options.pretrained
  })
  log(`Accuracy = ${accuracy}`)
}

main()
