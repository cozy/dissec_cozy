import fs from 'fs'
import CozyClient, { Q } from 'cozy-client'
import { BANK_DOCTYPE } from '../../doctypes'
import { Model, createLogger } from './helpers'
import dissecConfig from '../../../dissec.config.json'

export const contribution = async () => {
  const { parents, nbShares, pretrained, executionId } = JSON.parse(
    process.env['COZY_PAYLOAD'] || {}
  )

  if (parents.length !== nbShares) {
    return
  }

  const client = CozyClient.fromEnv(process.env, {})

  const log = createLogger(client.stackClient.uri)

  // Fetch training data
  const { data: operations } = await client.query(Q(BANK_DOCTYPE))

  // Fetch model
  let model
  if (pretrained) {
    try {
      let backup = fs.readFileSync(dissecConfig.localModelPath)
      model = Model.fromBackup(backup)

      model.train(operations)
    } catch (e) {
      throw `Model does not exist at path ${dissecConfig.localModelPath}`
    }
  } else {
    model = Model.fromDocs(operations)
  }

  // Storing shares as files to be shared
  // Create or find a DISSEC directory
  const baseFolder = 'DISSEC'
  const parentDirectory = { _id: 'io.cozy.files.root-dir', attributes: {} }
  const { data: dissecDirectory } = await client
    .collection('io.cozy.files')
    .getDirectoryOrCreate(baseFolder, parentDirectory)

  // Create a directory specifically for this aggregation
  // This prevents mixing shares from different execution
  const { data: aggregationDirectoryDoc } = await client
    .collection('io.cozy.files')
    .getDirectoryOrCreate(executionId, dissecDirectory)
  const aggregationDirectoryId = aggregationDirectoryDoc._id

  // Split model in shares
  let shares = model.getCompressedShares(nbShares)

  // Create a file for each share
  const files = []
  for (let i in shares) {
    const { data: file } = await client.create('io.cozy.files', {
      type: 'file',
      name: `contribution_${i}`,
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
    await new Promise(resolve => setTimeout(resolve, 5000))
    // TODO: Launch the webhook without using fetchJSON
    await client.stackClient.fetchJSON('POST', parents[i].webhook, {
      executionId,
      docId: files[i],
      sharecode: shareCodes[i],
      uri: client.stackClient.uri,
      nbShares,
      parent: parents[i].parent,
      finalize: parents[i].finalize,
      level: parents[i].level,
      aggregatorId: parents[i].aggregatorId,
      nbChild: parents[i].nbChild
    })
    log('Activated webhook', parents[i].webhook)
  }
}

contribution().catch(e => {
  // eslint-disable-next-line no-console
  console.log('critical', e)
  process.exit(1)
})
