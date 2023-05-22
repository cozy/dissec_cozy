import CozyClient, { Q } from 'cozy-client'
import fs from 'fs'

import dissecConfig from '../../../dissec.config.json'
import { createLogger } from './helpers'
import { Model } from './model'
import { sendObservation } from '../../lib/sendObservation'

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
    group,
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
  // Matching shares are uniquely identified by the nodeId of the aggregator
  const receivedShares = unfilteredFiles.filter(
    file =>
      file.attributes.metadata && file.attributes.metadata.nodeId === nodeId
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

    await sendObservation({
      client,
      supervisorWebhook,
      payload: {
        executionId,
        action: 'aggregation',
        emitterDomain: domain,
        emitterId: nodeId,
        receiverDomain: domain,
        receiverId: nodeId,
        payload: { finished: true }
      }
    })
  } else {
    // Only using the corresponding parent
    const index = group.indexOf(nodeId)
    // Use the first parent when it is the final aggregator
    const parent = parents[0]?.finalize ? parents[0] : parents[index]

    // Store the aggregate as a file to be shared
    const { data: aggregate } = await client.create('io.cozy.files', {
      type: 'file',
      name: `aggregator${nodeId}_destination${parent.nodeId}`,
      dirId: aggregationDirectoryId,
      data: model.getCompressedAggregate()
    })

    log('Created intermediate aggregate')

    // Generate share code
    const code = `parent${nodeId}`
    const { data: sharing } = await client.create('io.cozy.permissions', {
      codes: code,
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
      ...parent,
      docId: aggregate.id,
      sharecode: shareCode,
      uri: client.stackClient.uri,
      supervisorWebhook
    }
    // TODO: Callwebhook without using fetchJSON
    await client.stackClient.fetchJSON(
      'POST',
      parent.aggregationWebhook,
      payload
    )

    await sendObservation({
      client,
      supervisorWebhook,
      payload: {
        executionId,
        action: 'aggregation',
        emitterDomain: domain,
        emitterId: nodeId,
        receiverDomain: parent.aggregationWebhook
          .split('/')
          .find(e => e.includes('localhost:8080')),
        receiverId: parent.nodeId,
        payload: payload
      }
    })
  }
}

aggregation().catch(e => {
  // eslint-disable-next-line no-console
  console.log('critical', e)
  process.exit(1)
})
