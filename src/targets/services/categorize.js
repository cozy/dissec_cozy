global.fetch = require('node-fetch').default

import fs from 'fs'
import CozyClient, { Q } from 'cozy-client'
import { BANK_DOCTYPE } from '../../doctypes'
import { Model } from './helpers'
import dissecConfig from '../../../dissec.config.json'

export const categorize = async () => {
  const { pretrained } = JSON.parse(process.env['COZY_PAYLOAD'] || '{}')

  const client = CozyClient.fromEnv(process.env, {})

  // 1. Fetch data
  const { data: operations } = await client.query(Q(BANK_DOCTYPE))

  // 2. Fetch model or initialize it
  let model
  if (pretrained) {
    // Use the stack's remote assets
    try {
      const compressedBackup = fs
        .readFileSync(dissecConfig.localModelPath)
        .toString()
      model = Model.fromCompressedBackup(compressedBackup)
    } catch (err) {
      throw `Model does not exist at path ${dissecConfig.localModelPath}`
    }
  } else {
    model = Model.fromDocs(operations)
  }

  // 3. Categorize each doc and update it
  operations.forEach(async operation => {
    const prediction = model.predict(operation.label)
    await client.save({
      ...operation,
      automaticCategoryId: prediction
    })
  })
}

categorize().catch(e => {
  // eslint-disable-next-line no-console
  console.log('critical', e)
  process.exit(1)
})
