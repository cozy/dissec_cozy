global.fetch = require('node-fetch').default
global.btoa = require('btoa')

import fs from 'fs'
import CozyClient, { Q } from 'cozy-client'
import { Model } from './helpers'
import dissecConfig from '../../../dissec.config.json'

export const aggregation = async () => {
  const client = CozyClient.fromEnv(process.env, {})

  var originalConsoleLog = console.log
  console.log = function () {
    let args = []
    args.push('[' + client.stackClient.uri.split('/')[2] + '] ')
    for (var i = 0; i < arguments.length; i++) {
      args.push(arguments[i])
    }
    originalConsoleLog.apply(console, args)
  }

  console.log('Aggregating', process.env['COZY_COUCH_DOC'])

  // Worker's arguments
  const {
    _id,
    dir_id: aggregationDirectory,
    name,
    metadata
  } = JSON.parse(process.env['COZY_COUCH_DOC'] || {})

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
  const { data: unfilteredFiles } = await client.query(Q('io.cozy.files').where({
    dir_id: aggregationDirectory
  }))
  const receivedShares = unfilteredFiles.filter(file => file.attributes.metadata && (file.attributes.metadata.level === level))

  console.log('Already received shares:', receivedShares.length)

  if (receivedShares.length !== nbChild) {
    console.log('Waiting for more...')
    return
  }

  console.log('Received the right amount of shares, let\'s start')

  // Fetch all stored shares
  const shares = []
  for (let s of receivedShares) {
    shares.push(
      JSON.parse(await client.stackClient.fetchJSON('GET', `/files/download/${s.id}`))
    )
  }

  console.log('Downloaded', shares.length, 'shares')

  // Combine the shares
  let model = Model.fromShares(shares, finalize)

  if (finalize) {
    // Write a file that will be used as a remote asset by the stack
    fs.writeFileSync(
      dissecConfig.localModelPath,
      JSON.stringify(model.getBackup())
    )
    console.log('Finished the execution, wrote model to disk')
  } else {
    // Store the aggregate as a file to be shared
    const { data: aggregate } = await client.stackClient.fetchJSON(
      'POST',
      `/files/${aggregationDirectory}?Type=file&Name=aggregator${aggregatorId}_level${level}_aggregate${aggregatorId}`,
      model.getBackup() // Backups are single shares with no noise
    )

    console.log('Created intermediate aggregate')

    // Generate share code
    const body = {
      data: {
        type: 'io.cozy.permissions',
        attributes: {
          source_id: aggregatorId,
          permissions: {
            shares: {
              type: 'io.cozy.files',
              verbs: ['GET', 'POST'],
              values: [aggregate.id]
            }
          }
        }
      }
    }
    const { data: sharing } = await client.stackClient.fetchJSON(
      'POST',
      `/permissions?codes=parent${aggregatorId}&ttl=1h`,
      body
    )
    const shareCode = sharing.attributes.shortcodes[`parent${aggregatorId}`]

    console.log('Sharing code is', shareCode)

    console.log('Sending intermediate aggregate via', parent.webhook)

    // Call parent's aggregation webhook to send the aggregate
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
