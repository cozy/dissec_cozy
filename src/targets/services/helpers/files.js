/**
 * Returns the id of the directory used to store intermediary aggregates
 * @param {CozyClient} client The client of the local instance
 */
export const getOrCreateAppDirectory = async (client, retries = 1) => {
  // Storing shares as files to be shared
  // Create or find a DISSEC directory
  const baseFolder = 'DISSEC'
  const parentDirectory = { _id: 'io.cozy.files.root-dir', attributes: {} }

  const getDirectory = async retriesLeft => {
    try {
      const { data: appDirectory } = await client
        .collection('io.cozy.files')
        .getDirectoryOrCreate(baseFolder, parentDirectory)

      return appDirectory
    } catch (err) {
      const error = Array.isArray(err) ? err[0] : err
      if (error.status === 409) {
        const { data } = await client
          .collection('io.cozy.files')
          .statByPath(`/DISSEC`)
        return data
      } else if (
        error.status === 500 &&
        error.detail === 'No DB shards could be opened.' &&
        retriesLeft > 0
      ) {
        console.log('CouchDB error, retrying...')
        return await getDirectory(retriesLeft - 1)
      } else {
        throw new Error(
          `Error while creating the app folder DISSEC: ${JSON.stringify(err)}`
        )
      }
    }
  }

  return getDirectory(retries)
}

export const deleteFilesById = async (client, ids) => {
  const promises = ids.map(
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
}
