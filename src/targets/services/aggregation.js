global.fetch = require('node-fetch').default
global.btoa = require('btoa')

import CozyClient, { Q } from 'cozy-client'
import { MODELS_DOCTYPE } from '../../doctypes'
import { Model } from './helpers'

export const aggregation = async () => {
  // Worker's arguments
  const { link, security, finalize } = process.env['COZY_PAYLOAD'] || []

  // eslint-disable-next-line no-console
  console.log('aggregation received', link)

  const client = CozyClient.fromEnv(process.env, {})

  // 1. Download share using provided link
  const result = await client.stackClient.fetchJSON('GET', link)
  const data = result.relationship.shared_docs.data

  // 2. If some shares are missing, end now
  if (data.length != security) return

  // 3. Fetch all stored shares
  let shares = await Promise.all(
    data.map(async e => {
      const res = await client.query(Q(e.type)).where({ _id: e.id })
      return res
    })
  )

  // 4. Compute sum or average if this node is the final aggregator
  let model = Model.fromShares(shares, finalize)

  // 5. Upload share to an external storage
  await client.create(MODELS_DOCTYPE, model.getBackup())
}

aggregation().catch(e => {
  // eslint-disable-next-line no-console
  console.log('critical', e)
  process.exit(1)
})
