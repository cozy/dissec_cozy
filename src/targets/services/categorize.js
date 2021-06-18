global.fetch = require('node-fetch').default
global.btoa = require('btoa')

import CozyClient, { Q } from 'cozy-client'
import { BANK_DOCTYPE, MODELS_DOCTYPE } from '../../doctypes'

import { Model } from './helpers'

export const categorize = async () => {
  const { modelId } = process.env['COZY_PAYLOAD'] || []

  // eslint-disable-next-line no-console
  console.log('categorize received', modelId)

  const client = CozyClient.fromEnv(process.env, {})

  // 1. Fetch data
  const { data: operations } = await client.query(Q(BANK_DOCTYPE))

  // 2. Fetch model or initialize it
  let model
  if (modelId) {
    let modelDoc = await client
      .query(Q(MODELS_DOCTYPE))
      .where({ _id: modelId })[0]

    model = Model.fromBackup(modelDoc)
  } else {
    model = Model.fromDocs(operations)
  }

  // 3. Categorize each doc and update it
  operations.forEach(operation =>
    client.save({
      ...operation,
      automaticCategoryId: model.predict(operation.label)
    })
  )
}

categorize().catch(e => {
  // eslint-disable-next-line no-console
  console.log('critical', e)
  process.exit(1)
})
