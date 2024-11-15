import CozyClient, { Q } from 'cozy-client'
import fs from 'fs'

import { BANK_OPERATIONS_DOCTYPE, JOBS_DOCTYPE } from 'doctypes'
import { sendObservation } from 'lib/sendObservation'
import { createLogger } from './helpers'
import { Model } from './model'
import dissecConfig from '../../../dissec.config.json'

global.fetch = require('node-fetch').default

export const categorize = async () => {
  const client = CozyClient.fromEnv(process.env, {})

  const { log } = createLogger(client.stackClient.uri.split('/')[2])

  // Fetching parameters (if any) from the jobs
  const { data: job } = await client.query(
    Q(JOBS_DOCTYPE).getById(process.env['COZY_JOB_ID'].split('/')[2])
  )

  const {
    pretrained,
    useTiny,
    supervisorWebhook,
    filters = {}
  } = job.attributes.message

  // Fetch data
  const operations = await client.queryAll(Q(BANK_OPERATIONS_DOCTYPE))

  // Fetch model or initialize it
  let model
  if (pretrained) {
    // Use the shared model
    // Load the remote asset
    try {
      const compressedAggregate = await client.stackClient.fetchJSON(
        'GET',
        '/remote/assets/dissec_model'
      )
      model = await Model.fromCompressedAggregate(compressedAggregate, {
        useTiny
      })
    } catch (err) {
      // TODO: Do not rely on the file system
      // throw `Remote asset (dissec_model) not found ? ${err}`
      const compressedAggregate = fs
        .readFileSync(dissecConfig.localModelPath)
        .toString()
      model = await Model.fromCompressedAggregate(compressedAggregate, {
        useTiny
      })
    }
  } else {
    // Apply filters first
    let filteredOperations = filters.minOperationDate
      ? operations.filter(
          e =>
            new Date(e.date).valueOf() <
            new Date(filters.minOperationDate).valueOf()
        )
      : operations

    model = await Model.fromDocs(filteredOperations, { useTiny })
    log(`Trained a local model on ${filteredOperations.length} operations`)
  }

  log(
    'Sum of occurences in the categorization model:',
    model.occurences.map((e, i) => [
      model.uniqueY[i],
      e.reduce((a, b) => a + b)
    ])
  )

  // Categorize each doc and update it
  const categoriesBefore = {}
  const categoriesAfter = {}
  const categorized = operations.map(operation => {
    const prediction = model.predict(operation.label)

    categoriesBefore[operation.cozyCategoryId || '0'] =
      (categoriesBefore[operation.cozyCategoryId || '0'] || 0) + 1 // Default to uncategorized
    categoriesAfter[prediction || '0'] =
      (categoriesAfter[prediction || '0'] || 0) + 1 // Default to uncategorized

    return {
      ...operation,
      previousCategoryId: operation.cozyCategoryId,
      cozyCategoryId: prediction
    }
  })
  await client.saveAll(categorized)

  await sendObservation({
    client,
    supervisorWebhook,
    observationPayload: {
      action: 'categorize',
      categoriesBefore,
      categoriesAfter
    }
  })
}

categorize().catch(e => {
  // eslint-disable-next-line no-console
  console.log('critical', e)
  process.exit(1)
})
