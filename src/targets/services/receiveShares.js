global.fetch = require('node-fetch').default
global.btoa = require('btoa')

import CozyClient from 'cozy-client'
import log from 'cozy-logger'

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
  } = JSON.parse(process.env['COZY_PAYLOAD'] || {})

  const client = CozyClient.fromEnv(process.env, {})

  const infoTag = 'info: [' + client.stackClient.uri.split('/')[2] + ']'

  log(infoTag, 'Received share')

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
  const share = await sharedClient.stackClient.fetchJSON(
    'GET',
    `/files/download/${docId}`
  )

  log(infoTag, 'Type of share', typeof share)

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
  log(infoTag, 'Aggregation folder id', aggregationDirectoryId)

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
  log(infoTag, 'Stored share!')
}

receiveShares().catch(e => {
  // eslint-disable-next-line no-console
  console.log('critical', e)
  process.exit(1)
})
