global.fetch = require('node-fetch').default

import CozyClient, { Q } from 'cozy-client'

import { createLogger, deleteFilesById, getAppDirectory } from './helpers'
import config from '../../../dissec.config.json'

/**
 * This service is launched periodically to erase old shares
 */
export const deleteOldShares = async () => {
  const client = CozyClient.fromEnv(process.env, {})
  const log = createLogger(client.stackClient.uri)
  const appDirectory = await getAppDirectory(client)

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

  await deleteFilesById(oldFileIds)

  log(oldFileIds.length, 'old files have been deleted')
}

deleteOldShares().catch(e => {
  // eslint-disable-next-line no-console
  console.log('critical', e)
  process.exit(1)
})
