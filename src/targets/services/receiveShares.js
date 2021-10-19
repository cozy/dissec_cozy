global.fetch = require('node-fetch').default

import CozyClient, { Q } from 'cozy-client'
import { createLogger } from './helpers'

export const receiveShares = async () => {
  // Worker's arguments
  const {
    docId,
    sharecode,
    uri,
    nbShares,
    parent,
    finalize,
    level,
    aggregatorId,
    executionId,
    nbChild
  } = JSON.parse(process.env['COZY_PAYLOAD'] || '{}')

  const client = CozyClient.fromEnv(process.env, {})

  const log = createLogger(client.stackClient.uri)

  log('Received share')

  // Download share using provided informations
  const sharedClient = new CozyClient({
    uri: uri,
    token: sharecode,
    schema: {
      files: {
        doctype: 'io.cozy.files',
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

  // TODO: Should use cozy-client, but fetchFileContentById uses fetch instead of fetchJSON
  const share = await sharedClient.stackClient.fetchJSON(
    'GET',
    `/files/download/${docId}`
  )

  log('Type of share', typeof share)

  // Storing shares as files to be shared
  // Create or find a DISSEC directory
  const baseFolder = 'DISSEC'
  const parentDirectory = { _id: 'io.cozy.files.root-dir', attributes: {} }
  const { data: dissecDirectory } = await client
    .collection('io.cozy.files')
    .getDirectoryOrCreate(baseFolder, parentDirectory)

  // Create a directory specifically for this aggregation
  // This prevents mixing shares from different execution
  // TODO: Remove hierarchy and base only on metadata and id
  const { data: aggregationDirectory } = await client
    .collection('io.cozy.files')
    .getDirectoryOrCreate(executionId, dissecDirectory)
  const aggregationDirectoryId = aggregationDirectory._id
  log('Aggregation folder id', aggregationDirectoryId)

  // Save the received share
  await client.create('io.cozy.files', {
    type: 'file',
    data: share,
    dirId: aggregationDirectoryId,
    name: `aggregator_${aggregatorId}_level_${level}_${sharecode}`,
    metadata: {
      dissec: true,
      executionId,
      aggregatorId,
      level,
      nbShares,
      parent,
      finalize,
      nbChild
    }
  })
  log('Stored share!')

  // Aggergations are triggered after writing the share
  // It prevents synchronicity issues
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

  log('Already stored shares:', receivedShares.length)

  if (receivedShares.length === nbChild) {
    log('Received the right amount of shares, starting!')
    client.collection('io.cozy.jobs').create('service', {
      message: {
        name: 'aggregation',
        slug: 'dissecozy'
      },
      metadata: {
        aggregationDirectoryId,
        dissec: true,
        executionId,
        aggregatorId,
        level,
        nbShares,
        parent,
        finalize
      }
    })
  }
}

receiveShares().catch(e => {
  // eslint-disable-next-line no-console
  console.log('critical', e)
  process.exit(1)
})
