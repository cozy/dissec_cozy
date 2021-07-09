global.fetch = require('node-fetch').default
global.btoa = require('btoa')

import fs from 'fs'
import CozyClient, { Q } from 'cozy-client'
import { BANK_DOCTYPE } from '../../doctypes'

import { Model } from './helpers'

export const categorize = async () => {
  const { pretrained } = JSON.parse(process.env['COZY_PAYLOAD'] || {})

  // eslint-disable-next-line no-console
  console.log('Passed arguments:', pretrained)

  const client = CozyClient.fromEnv(process.env, {})

  // 1. Fetch data
  const { data: operations } = await client.query(Q(BANK_DOCTYPE))
  console.log('Found', operations.length, 'operations')

  // 2. Fetch model or initialize it
  let model
  if (pretrained) {
    // Use the stack's remote assets
    try {
      const backup = JSON.parse(
        fs.readFileSync('/mnt/c/Users/Projets/Cozy/categorization-model/model.json')
      )
      model = Model.fromBackup(backup)
    } catch (err) {
      console.log('Failed opening backup', err)
      model = Model.fromDocs(operations)
    }
  } else {
    model = Model.fromDocs(operations)
  }

  // 3. Categorize each doc and update it
  operations.forEach(
    async operation => {
      const prediction =  model.predict(operation.label)
      await client.save({
        ...operation,
        automaticCategoryId: prediction
      })
    }
  )
}

categorize().catch(e => {
  // eslint-disable-next-line no-console
  console.log('critical', e)
  process.exit(1)
})
