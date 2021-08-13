global.fetch = require('node-fetch').default
global.btoa = require('btoa')

import fs from 'fs'
import CozyClient, { Q } from 'cozy-client'
import log from 'cozy-logger'

import { Model } from './helpers'
import dissecConfig from '../../../dissec.config.json'

export const aggregation = async () => {
  const client = CozyClient.fromEnv(process.env, {})

  const infoTag = 'info: [' + client.stackClient.uri.split('/')[2] + ']'

  log(
    infoTag,
    'Aggregating service called because a document is received:',
    process.env['COZY_COUCH_DOC']
  )

  // Worker's arguments
  const { dir_id: aggregationDirectoryId, metadata } = JSON.parse(
    process.env['COZY_COUCH_DOC'] || {}
  )

  // This file is not a share uploaded by an aggregator for himself
  if (!(metadata && metadata.dissec)) return

  const {
    executionId,
    aggregatorId,
    level,
    nbShares,
    parent,
    finalize,
    nbChild
  } = metadata

  // TODO: Remove hierarchy and base only on metadata and id
  // Count files in the aggregation folder
  const { data: unfilteredFiles } = await client.query(
    Q('io.cozy.files').where({
      dir_id: aggregationDirectoryId
    })
  )
  const receivedShares = unfilteredFiles.filter(
    file => file.attributes.metadata && file.attributes.metadata.level === level
  )

  log(infoTag, 'Already received shares:', receivedShares.length)

  if (receivedShares.length !== nbChild) {
    log(infoTag, 'Waiting for more...')
    return
  }

  log(infoTag, 'Received the right amount of shares, starting!')

  // Fetch all stored shares
  const shares = []
  for (let s of receivedShares) {
    const receivedShare = await client.stackClient.fetchJSON(
      'GET',
      `/files/download/${s._id}`
    )
    shares.push(JSON.parse(receivedShare))
  }

  log(infoTag, 'Downloaded', shares.length, 'shares')

  // Combine the shares
  let model = Model.fromShares(shares, finalize)

  if (finalize) {
    // Write a file that will be used as a remote asset by the stack
    fs.writeFileSync(
      dissecConfig.localModelPath,
      JSON.stringify(model.getBackup())
    )
    log(infoTag, 'Finished the execution, wrote model to disk')
  } else {
    // Store the aggregate as a file to be shared
    const { data: aggregate } = await client.create('io.cozy.files', {
      type: 'file',
      name: `aggregator${aggregatorId}_level${level}_aggregate${aggregatorId}`,
      dirId: aggregationDirectoryId,
      data: JSON.stringify(model.getBackup())
    })

    log(infoTag, 'Created intermediate aggregate')

    // Generate share code
    const { data: sharing } = await client.create('io.cozy.permissions', {
      codes: `parent${aggregatorId}`,
      ttl: '1h',
      permissions: {
        shares: {
          type: 'io.cozy.files',
          verbs: ['GET', 'POST'],
          values: [aggregate.id]
        }
      }
    })
    const shareCode = sharing.attributes.shortcodes[`parent${aggregatorId}`]

    log(infoTag, 'Sharing code is', shareCode)

    log(infoTag, 'Sending intermediate aggregate via', parent.webhook)

    // Call parent's aggregation webhook to send the aggregate
    // TODO: Callwebhook without using fetchJSON
    await client.stackClient.fetchJSON('POST', parent.webhook, {
      executionId,
      docId: aggregate.id,
      sharecode: shareCode,
      uri: client.stackClient.uri,
      nbShares,
      parent: parent.parent,
      finalize: parent.finalize,
      level: parent.level,
      aggregatorId: parent.aggregatorId,
      nbChild: parent.nbChild
    })
  }
}

aggregation().catch(e => {
  // eslint-disable-next-line no-console
  console.log('critical', e)
  process.exit(1)
})
