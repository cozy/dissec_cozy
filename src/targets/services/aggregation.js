global.fetch = require('node-fetch').default

import fs from 'fs'
import CozyClient, { Q } from 'cozy-client'

import { Model, createLogger } from './helpers'
import dissecConfig from '../../../dissec.config.json'

export const aggregation = async () => {
  const client = CozyClient.fromEnv(process.env, {})

  const log = createLogger(client.stackClient.uri)

  log(
    'Aggregating service called because a document is received:',
    process.env['COZY_COUCH_DOC']
  )

  // Worker's arguments
  const { dir_id: aggregationDirectoryId, metadata } = JSON.parse(
    process.env['COZY_COUCH_DOC'] || '{}'
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

  log('Already received shares:', receivedShares.length)

  if (receivedShares.length !== nbChild) {
    log('Waiting for more...')
    return
  }

  log('Received the right amount of shares, starting!')

  // Fetch all stored shares
  const compressedShares = []
  for (let s of receivedShares) {
    // TODO: Should use cozy-client, but fetchFileContentById uses fetch instead of fetchJSON
    const receivedShare = await client.stackClient.fetchJSON(
      'GET',
      `/files/download/${s._id}`
    )
    compressedShares.push(receivedShare)
  }

  log('Downloaded', compressedShares.length, 'shares')

  // Combine the shares
  let model = Model.fromCompressedShares(compressedShares, {
    shouldFinalize: finalize
  })

  if (finalize) {
    // Write a file that will be used as a remote asset by the stack
    fs.writeFileSync(
      dissecConfig.localModelPath,
      model.getCompressedAggregate()
    )
    log('Finished the execution, wrote model to disk')
  } else {
    // Store the aggregate as a file to be shared
    const { data: aggregate } = await client.create('io.cozy.files', {
      type: 'file',
      name: `aggregator${aggregatorId}_level${level}_aggregate${aggregatorId}`,
      dirId: aggregationDirectoryId,
      data: model.getCompressedAggregate()
    })

    log('Created intermediate aggregate')

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

    log('Sharing code is', shareCode)

    log('Sending intermediate aggregate via', parent.webhook)

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
