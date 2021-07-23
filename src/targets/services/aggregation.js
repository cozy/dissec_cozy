global.fetch = require('node-fetch').default
global.btoa = require('btoa')

import fs from 'fs'
import CozyClient from 'cozy-client'
import { Model } from './helpers'
import dissecConfig from '../../../dissec.config.json'
import { SHARES_DOCTYPE } from '../../../src/doctypes'

export const aggregation = async () => {
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

  // eslint-disable-next-line no-console
  console.log('aggregation received', process.env['COZY_PAYLOAD'])

  const client = CozyClient.fromEnv(process.env, {})

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
    dissecDirectory = data.id
  } catch (e) {
    console.log('DISSEC folder already exists')
    const { included } = await client.stackClient.fetchJSON(
      'GET',
      '/files/io.cozy.files.root-dir'
    )
    dissecDirectory = included.filter(
      dir => dir.attributes.name === baseFolder
    )[0].id
  }

  // Create a directory specifically for this aggregation
  // This prevents mixing shares from different execution
  let aggregationDirectory
  try {
    const { data } = await client.stackClient.fetchJSON(
      'POST',
      `/files/${dissecDirectory}?Type=directory&Name=${executionId}`
    )
    aggregationDirectory = data
  } catch (e) {
    console.log(
      `Execution folder already exists, fetching ${dissecDirectory} instead`
    )
    const { included } = await client.stackClient.fetchJSON(
      'GET',
      `/files/${dissecDirectory}`
    )
    aggregationDirectory = included.filter(
      dir => dir.attributes.name === executionId
    )[0].id
  }

  // Fetch currently owned shares
  console.log(`Fetching the content of folder ${aggregationDirectory}`)
  const { included: allSharesReceived } = await client.stackClient.fetchJSON(
    'GET',
    `/files/${aggregationDirectory}`
  )
  // Filter only the shares for the aggregator in this position
  const sharesReceived = allSharesReceived.filter(dir =>
    dir.attributes.name.includes(`aggregator${aggregatorId}_level${level}`)
  )
  const received = sharesReceived.length
  console.log(`Found ${received} shares`)

  // Check if shares of each child has been received
  if (received < nbChild - 1) {
    // Some shares are missing
    // Save the received share
    console.log(`Aggregator ${aggregatorId} storing share ${received} while waiting for more`)
    await client.stackClient.fetchJSON(
      'POST',
      `/files/${aggregationDirectory}?Type=file&Name=aggregator${aggregatorId}_level${level}_${sharecode}`,
      share
    )
    // Wait for more shares
    return
  }

  // Fetch all stored shares
  const shares = [share]
  for (let s of sharesReceived) {
    console.log(`Downloading share ${received} `)
    shares.push(
      await client.stackClient.fetchJSON('GET', `/files/download/${s.id}`)
    )
  }

  if (shares.length !== nbChild) throw 'Invalid number of shares received!'

  // Combine the shares
  let model = Model.fromShares(shares, finalize)

  if (finalize) {
    // Write a file that will be used as a remote asset by the stack
    fs.writeFileSync(
      dissecConfig.localModelPath,
      JSON.stringify(model.getBackup())
    )
  } else {
    // Store the aggregate as a file to be shared
    const { data: aggregate } = await client.stackClient.fetchJSON(
      'POST',
      `/files/${aggregationDirectory}?Type=file&Name=aggregator${aggregatorId}_level${level}_aggregate${aggregatorId}`,
      model.getBackup() // Backups are single shares with no noise
    )

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

  console.log('Finished execution of aggregation by', aggregatorId, '\n\n')
}

aggregation().catch(e => {
  // eslint-disable-next-line no-console
  console.log('critical', e)
  process.exit(1)
})
