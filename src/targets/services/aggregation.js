global.fetch = require('node-fetch').default
global.btoa = require('btoa')

import fs from 'fs'
import CozyClient, { Q } from 'cozy-client'
import { SHARES_DOCTYPE } from '../../doctypes'
import { Model } from './helpers'
import dissecConfig from '../../../dissec.config.json'

export const aggregation = async () => {
  // Worker's arguments
  const { docId, sharecode, uri, nbShares, parents, finalize, level, executionId } = JSON.parse(process.env['COZY_PAYLOAD'] || {})

  // eslint-disable-next-line no-console
  console.log('aggregation received', process.env['COZY_PAYLOAD'])

  const client = CozyClient.fromEnv(process.env, {})

  // 1. Download share using provided informations
  const sharedClient = new CozyClient({
    uri: uri,
    token: sharecode,
    schema: {
      files: {
        doctype: "io.cozy.files",
        relationships: {
          old_versions: {
            type: 'has-many',
            doctype: 'io.cozy.files.versions'
          }
        }
      }
    },
    store: false
  })
  console.log("Requesting the share")
  const share = await sharedClient.stackClient.fetchJSON('GET', `/files/download/${docId}`)
  console.log(Object.keys(share))

  // 2. Save the document

  // 3. If some shares are missing, end now
  if (data.length != nbShares) return

  // 4. Fetch all stored shares
  let shares = await Promise.all(
    data.map(async e => {
      const res = await client.query(Q(e.type)).where({ _id: e.id })
      return res
    })
  )

  // 5. Compute sum or average if this node is the final aggregator
  let model = Model.fromShares(shares, finalize)

  if (finalize) {
    // 6. Write a file that will be used as a remote asset by the stack
    fs.writeFileSync(
      dissecConfig.localModelPath,
      JSON.stringify(model.getBackup())
    )
  } else {
    // Call parent's aggregation webhook
  }
}

aggregation().catch(e => {
  // eslint-disable-next-line no-console
  console.log('critical', e)
  process.exit(1)
})
