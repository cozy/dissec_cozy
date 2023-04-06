import CozyClient, { Q } from 'cozy-client'

import { createLogger, getAppDirectory } from './helpers'

global.fetch = require('node-fetch').default

export const receiveShares = async () => {
  // Worker's arguments
  const {
    docId,
    sharecode,
    uri,
    nbShares,
    parents,
    finalize,
    level,
    aggregatorId,
    executionId,
    nbChild,
    useTiny
  } = JSON.parse(process.env['COZY_PAYLOAD'] || '{}')

  const client = CozyClient.fromEnv(process.env, {})

  const { log } = createLogger(client.stackClient.uri.split('/')[2])

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

  const response = await sharedClient
    .collection('io.cozy.files')
    .fetchFileContentById(docId)
  const share = await response.text()

  const appDirectory = await getAppDirectory(client)

  // Create a directory specifically for this aggregation
  // This prevents mixing shares from different execution
  // TODO: Remove hierarchy and base only on metadata and id
  let aggregationDirectory
  try {
    const { data } = await client
      .collection('io.cozy.files')
      .getDirectoryOrCreate(executionId, appDirectory)
    aggregationDirectory = data
  } catch (err) {
    if (err.status === 409) {
      const { data } = await client
        .collection('io.cozy.files')
        .statByPath(`${appDirectory.attributes.path}/${executionId}`)
      aggregationDirectory = data
    } else {
      throw new Error(
        `Error while creating the execution folder ${executionId}`
      )
    }
  }

  // Save the received share
  await client.create('io.cozy.files', {
    type: 'file',
    data: share,
    dirId: aggregationDirectory._id,
    name: `aggregator_${aggregatorId}_level_${level}_${sharecode}`,
    metadata: {
      dissec: true,
      executionId,
      aggregatorId,
      level,
      nbShares,
      parents,
      finalize,
      nbChild,
      useTiny
    }
  })
  log('Stored share!')

  // Aggregations are triggered after writing the share
  // It prevents synchronicity issues
  // TODO: Remove hierarchy and base only on metadata and id
  // Count files in the aggregation folder
  const { data: unfilteredFiles } = await client.query(
    Q('io.cozy.files')
      .where({
        dir_id: aggregationDirectory._id
      })
      .indexFields(['dir_id'])
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
        aggregationDirectoryId: aggregationDirectory._id,
        dissec: true,
        executionId,
        aggregatorId,
        level,
        nbShares,
        parents,
        finalize,
        useTiny
      }
    })
  }
}

receiveShares().catch(e => {
  // eslint-disable-next-line no-console
  console.log('critical', e)
  process.exit(1)
})
