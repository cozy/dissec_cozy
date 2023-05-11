import CozyClient, { Q } from 'cozy-client'
import fs from 'fs'

import dissecConfig from '../../../dissec.config.json'
import { createLogger } from './helpers'
import { Model } from './model'

global.fetch = require('node-fetch').default

export const aggregation = async () => {
  const client = CozyClient.fromEnv(process.env, {})

  const domain = client.stackClient.uri.split('/')[2]
  const { log } = createLogger(domain)

  const jobId = process.env['COZY_JOB_ID'].split('/')[2]

  log('Aggregating service. Fetching job: ', jobId)

  // Retrieve arguments stored in the jobs
  const job = await client.query(Q('io.cozy.jobs').getById(jobId))

  const {
    aggregationDirectoryId,
    executionId,
    nodeId,
    level,
    treeStructure,
    parents,
    finalize,
    useTiny,
    supervisorWebhook
  } = job.data.attributes.message.metadata

  // Aggregators only use one parent
  if (!finalize && !parents?.length) {
    throw new Error('Invalid parents')
  }

  const { data: unfilteredFiles } = await client.query(
    Q('io.cozy.files')
      .where({
        dir_id: aggregationDirectoryId
      })
      .indexFields(['dir_id'])
  )
  const receivedShares = unfilteredFiles.filter(
    file => file.attributes.metadata && file.attributes.metadata.level === level
  )

  // Fetch all stored shares
  const compressedShares = []
  for (let s of receivedShares) {
    const response = await client
      .collection('io.cozy.files')
      .fetchFileContentById(s._id)
    const receivedShare = await response.text()
    compressedShares.push(receivedShare)
  }

  log(
    `Downloaded ${compressedShares.length} shares${
      finalize ? ', finalizing' : ''
    }`
  )

  // Combine the shares
  let model = Model.fromCompressedShares(compressedShares, {
    shouldFinalize: finalize,
    useTiny
  })

  if (finalize) {
    // Write a file that will be used as a remote asset by the stack
    fs.writeFileSync(
      dissecConfig.localModelPath,
      model.getCompressedAggregate()
    )
    log('Model has been written to the disk')

    if (supervisorWebhook) {
      // Send an observation to the supervisor
      await client.stackClient.fetchJSON('POST', supervisorWebhook, {
        executionId,
        action: 'aggregation',
        emitterDomain: domain,
        emitterId: nodeId,
        receiverDomain: domain,
        receiverId: nodeId,
        payload: { finished: true }
      })

      log(`Sent final observation to ${supervisorWebhook}`)
    }
  } else {
    // Only using the first parent for aggregators
    const parent = parents[0]

    // Store the aggregate as a file to be shared
    const { data: aggregate } = await client.create('io.cozy.files', {
      type: 'file',
      name: `aggregator${nodeId}_level${level}_aggregate${nodeId}`,
      dirId: aggregationDirectoryId,
      data: model.getCompressedAggregate()
    })

    log('Created intermediate aggregate')

    // Generate share code
    const { data: sharing } = await client.create('io.cozy.permissions', {
      codes: `parent${nodeId}`,
      ttl: '1h',
      permissions: {
        shares: {
          type: 'io.cozy.files',
          verbs: ['GET', 'POST'],
          values: [aggregate.id]
        }
      }
    })
    const shareCode = sharing.attributes.shortcodes[`parent${nodeId}`]

    log('Sharing code is', shareCode, 'sent to', parent.aggregationWebhook)

    // Call parent's receiving webhook to send the aggregate
    const payload = {
      executionId,
      docId: aggregate.id,
      sharecode: shareCode,
      uri: client.stackClient.uri,
      treeStructure,
      parents: parent.parents,
      finalize: parent.finalize,
      level: parent.level,
      nodeId: parent.nodeId,
      supervisorWebhook
    }
    // TODO: Callwebhook without using fetchJSON
    await client.stackClient.fetchJSON(
      'POST',
      parent.aggregationWebhook,
      payload
    )

    if (supervisorWebhook) {
      // Send an observation to the supervisor
      await client.stackClient.fetchJSON('POST', supervisorWebhook, {
        executionId,
        action: 'aggregation',
        emitterDomain: domain,
        emitterId: nodeId,
        receiverDomain: parent.aggregationWebhook
          .split('/')
          .find(e => e.includes('localhost:8080')),
        receiverId: parent.nodeId,
        payload: payload
      })

      log(`Sent an observation to ${supervisorWebhook}`)
    }
  }
}

aggregation().catch(e => {
  // eslint-disable-next-line no-console
  console.log('critical', e)
  process.exit(1)
})
