import CozyClient, { Q } from 'cozy-client'
import fs from 'fs'

import dissecConfig from '../../../dissec.config.json'
import { BANK_DOCTYPE } from '../../doctypes'
import { createLogger, getAppDirectory } from './helpers'
import { Model } from './model'

global.fetch = require('node-fetch').default

export const contribution = async () => {
  const {
    parents,
    nbShares,
    pretrained,
    executionId,
    nodeId,
    useTiny,
    supervisorWebhook,
    filters = {}
  } = JSON.parse(process.env['COZY_PAYLOAD'] || '{}')

  if (parents.length !== nbShares) {
    return
  }

  const client = CozyClient.fromEnv(process.env, {})

  const domain = client.stackClient.uri.split('/')[2]
  const { log } = createLogger(domain)

  const selector = filters.minOperationDate
    ? {
        date: { $lte: filters.minOperationDate }
      }
    : {}

  // Fetch training data
  const { data: operations } = await client.query(
    Q(BANK_DOCTYPE)
      .where(selector)
      .sortBy([{ date: 'asc' }])
  )

  // Fetch model
  let model
  if (pretrained) {
    try {
      let backup = fs.readFileSync(dissecConfig.localModelPath)
      model = Model.fromCompressedAggregate(backup, { useTiny: true })

      model.train(operations)
    } catch (e) {
      throw `Model does not exist at path ${dissecConfig.localModelPath}`
    }
  } else {
    model = await Model.fromDocs(operations, { useTiny: true })
  }

  const appDirectory = await getAppDirectory(client)

  // Create a directory specifically for this aggregation
  // This prevents mixing shares from different execution
  const { data: aggregationDirectoryDoc } = await client
    .collection('io.cozy.files')
    .getDirectoryOrCreate(executionId, appDirectory)
  const aggregationDirectoryId = aggregationDirectoryDoc._id

  // Split model in shares
  let shares = model.getCompressedShares(nbShares)

  // Create a file for each share
  const files = []
  for (let i in shares) {
    const { data: file } = await client.create('io.cozy.files', {
      type: 'file',
      name: `contribution_${i}_${nodeId}`,
      dirId: aggregationDirectoryId,
      data: shares[i]
    })
    files.push(file._id)
  }

  // Create sharing permissions for shares
  const shareCodes = []
  for (let i in files) {
    const { data: sharing } = await client.create('io.cozy.permissions', {
      codes: `aggregator${i}`,
      ttl: '1h',
      permissions: {
        shares: {
          type: 'io.cozy.files',
          verbs: ['GET', 'POST'],
          values: [files[i]]
        }
      }
    })
    shareCodes.push(sharing.attributes.shortcodes[`aggregator${i}`])
  }

  // Call webhooks of parents with the share
  for (let i in shareCodes) {
    // HACK: Using a delay to give enough time to the responding service to store shares
    await new Promise(resolve =>
      setTimeout(resolve, 2000 * (1 + Math.random()))
    )

    const payload = {
      executionId,
      docId: files[i],
      sharecode: shareCodes[i],
      uri: client.stackClient.uri,
      nbShares,
      parents: parents[i].parents,
      finalize: parents[i].finalize,
      level: parents[i].level,
      nodeId: parents[i].nodeId,
      nbChild: parents[i].nbChild,
      useTiny,
      supervisorWebhook
    }

    // TODO: Launch the webhook without using fetchJSON
    await client.stackClient.fetchJSON(
      'POST',
      parents[i].aggregationWebhook,
      payload
    )

    if (supervisorWebhook) {
      // Send an observation to the supervisor
      await client.stackClient.fetchJSON('POST', supervisorWebhook, {
        executionId,
        action: 'contribution',
        emitterDomain: domain,
        emitterId: nodeId,
        receiverDomain: parents[i].aggregationWebhook
          .split('/')
          .find(e => e.includes('localhost:8080')),
        receiverId: parents[i].nodeId,
        payload
      })

      log(`Sent an observation to ${supervisorWebhook}`)
    }

    log(
      `Sent share ${Number(i) + 1} to aggregator ${
        parents[i].aggregationWebhook
      }`
    )
  }
}

contribution().catch(e => {
  // eslint-disable-next-line no-console
  console.log('critical', e)
  process.exit(1)
})
