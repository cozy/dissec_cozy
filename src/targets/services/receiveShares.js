global.fetch = require('node-fetch').default
global.btoa = require('btoa')

import CozyClient from 'cozy-client'
import { Model } from './helpers'

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

  var originalConsoleLog = console.log
  console.log = function () {
    let args = []
    args.push('[' + client.stackClient.uri.split('/')[2] + '] ')
    for (var i = 0; i < arguments.length; i++) {
      args.push(arguments[i])
    }
    originalConsoleLog.apply(console, args)
  }

  console.log('Received share')

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

  // Storing shares as files to be shared
  // Create or find a DISSEC directory
  const baseFolder = 'DISSEC'
  let dissecDirectory
  try {
    const { data } = await client.stackClient.fetchJSON(
      'POST',
      `/files/io.cozy.files.root-dir?Type=directory&Name=${baseFolder}`
    )
    console.log('Created DISSEC directory:', data)
    dissecDirectory = data.id
  } catch (e) {
    const { included } = await client.stackClient.fetchJSON(
      'GET',
      '/files/io.cozy.files.root-dir'
    )
    dissecDirectory = included.filter(
      dir => dir.attributes.name === baseFolder
    )[0].id
    console.log('Found DISSEC directory:', dissecDirectory)
  }

  // Create a directory specifically for this aggregation
  // This prevents mixing shares from different execution
  // TODO: Remove hierarchy and base only on metadata and id
  let aggregationDirectory
  try {
    console.log('Creating aggregation folder in', dissecDirectory, 'with name', executionId)
    const { data } = await client.stackClient.fetchJSON(
      'POST',
      `/files/${dissecDirectory}?Type=directory&Name=${executionId}`
    )
    console.log('Created aggregation directory:', data)
    aggregationDirectory = data.id
  } catch (e) {
    // Finding the folder with the correct name
    console.log('Failed creating folder', executionId)
    const { included } = await client.stackClient.fetchJSON(
      'GET',
      `/files/${dissecDirectory}`
    )
    const dir = included.filter(
      dir => dir.attributes.name === executionId
    )[0]
    if (!dir) {
      console.log(included, '\n\n', dir)
    }
    console.log('Aggregation folder already exists: ', dir)
    aggregationDirectory = dir.id
  }

  // Save the received share
  await client.create('io.cozy.files', {
    type: 'file',
    data: JSON.stringify(share),
    dirId: aggregationDirectory,
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
  console.log('Stored share!')
}

receiveShares().catch(e => {
  // eslint-disable-next-line no-console
  console.log('critical', e)
  process.exit(1)
})
