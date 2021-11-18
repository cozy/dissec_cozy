global.fetch = require('node-fetch').default

import CozyClient, { Q } from 'cozy-client'
import { createLogger, getAppDirectory } from './helpers'

import config from '../../../dissec.config.json'

/**
 * This service can be launched in two ways:
 * - Periodically to erase old shares
 * - Occasionally to remove specific shares
 *
 * When triggered, it requires a list of file ids
 */
export const deleteOldShares = async () => {
  const client = CozyClient.fromEnv(process.env, {})
  const log = createLogger(client.stackClient.uri)
  const appDirectory = await getAppDirectory(client)

  // Retrieve arguments stored in the jobs
  const jobId = process.env['COZY_JOB_ID'].split('/')[2]
  const job = await client.query(Q('io.cozy.jobs').getById(jobId))
  log(`Deleting old shares. Job ID: ${jobId}`)

  if (job.data.attributes.message.metadata) {
    const { fileIds } = job.data.attributes.message.metadata

    const promises = fileIds.map(
      id =>
        new Promise(async (resolve, reject) => {
          try {
            await client.collection('io.cozy.files').deleteFilePermanently(id)
            resolve()
          } catch (err) {
            reject(err)
          }
        })
    )

    await Promise.all(promises)
  } else {
    try {
      const { data: unfilteredFiles } = await client.query(
        Q('io.cozy.files')
          .where({
            dir_id: appDirectory._id
          })
          .indexFields(['dir_id'])
      )

      const oldFileIds = unfilteredFiles
        .filter(
          file =>
            (Date.now() - new Date(file.updated_at).valueOf()) / 1000 >
            config.secondsBeforeDeletion
        )
        .map(file => file.id)

      const promises = oldFileIds.map(
        id =>
          new Promise(async (resolve, reject) => {
            try {
              await client.collection('io.cozy.files').deleteFilePermanently(id)
              resolve()
            } catch (err) {
              reject(err)
            }
          })
      )

      await Promise.all(promises)
      
      log(oldFileIds.length, 'old files have been deleted')
    } catch (err) {
      log('No files to delete', err)
      return
    }
  }
}

deleteOldShares().catch(e => {
  // eslint-disable-next-line no-console
  console.log('critical', e)
  process.exit(1)
})
