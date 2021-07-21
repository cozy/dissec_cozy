global.fetch = require('node-fetch').default
global.btoa = require('btoa')

import fs from 'fs'
import CozyClient, { Q } from 'cozy-client'
import { BANK_DOCTYPE } from '../../doctypes'
import { Model } from './helpers'
import dissecConfig from '../../../dissec.config.json'

export const contribution = async () => {
  const { parents, nbShares, pretrained, executionId } = JSON.parse(
    process.env['COZY_PAYLOAD'] || {}
  )

  if (parents.length !== nbShares) {
    return
  }

  const client = CozyClient.fromEnv(process.env, {})

  // Fetch training data
  const { data: operations } = await client.query(Q(BANK_DOCTYPE))

  // Fetch model
  let model
  if (pretrained) {
    try {
      let backup = fs.readFileSync(
        dissecConfig.localModelPath
      )
      model = Model.fromBackup(backup)

      model.train(operations)
    } catch (e) {
      model = Model.fromDocs(operations)
    }
  } else {
    model = Model.fromDocs(operations)
  }

  // Split model in shares
  let shares = model.getShares(nbShares)

  // Storing shares as files to be shared
  // Create or find a DISSEC directory
  const baseFolder = 'DISSEC'
  let dissecDirectory
  try {
    const { data } = await client.stackClient.fetchJSON(
      'POST',
      `/files/io.cozy.files.root-dir?Type=directory&Name=${baseFolder}`
    )
    dissecDirectory = data.id
  } catch (e) {
    const { included } = await client.stackClient.fetchJSON(
      'GET',
      '/files/io.cozy.files.root-dir'
    )
    dissecDirectory = included.filter(
      dir => dir.attributes.name === baseFolder
    )[0].id
  }

  // Create a directory specifically for this aggregation
  // This prevents mixing shares from different execution
  const { data: aggregationDirectory } = await client.stackClient.fetchJSON(
    'POST',
    `/files/${dissecDirectory}?Type=directory&Name=${executionId}`
  )

  // Create a file for each share
  const files = []
  for (let i in shares) {
    const { data: file } = await client.stackClient.fetchJSON(
      'POST',
      `/files/${aggregationDirectory.id}?Type=file&Name=contribution-${i}`,
      shares[i]
    )
    files.push(file.id)
  }

  // Create sharing permissions for shares
  const shareCodes = []
  for (let i in files) {
    const body = {
      data: {
        type: 'io.cozy.permissions',
        attributes: {
          source_id: 'io.cozy.dissec.shares',
          permissions: {
            shares: {
              type: 'io.cozy.files',
              verbs: ['GET', 'POST'],
              values: [files[i]]
            }
          }
        }
      }
    }
    const { data: sharing } = await client.stackClient.fetchJSON(
      'POST',
      `/permissions?codes=aggregator${i}&ttl=1h`,
      body
    )
    shareCodes.push(sharing.attributes.shortcodes[`aggregator${i}`])
  }

  // Call webhooks of parents with the share.
  shareCodes.forEach(async (code, i) => {
    await client.stackClient.fetchJSON('POST', parents[i].webhook, {
      executionId,
      docId: files[i],
      sharecode: code,
      uri: client.stackClient.uri,
      nbShares,
      parents: parents[i].parents,
      finalize: parents[i].finalize,
      level: parents[i].level
    })
  })
}

contribution().catch(e => {
  // eslint-disable-next-line no-console
  console.log('critical', e)
  process.exit(1)
})
