/**
 * Returns the id of the directory used to store intermediary aggregates
 * @param {CozyClient} client The client of the local instance
 */
export const getOrCreateAppDirectory = async client => {
  // Storing shares as files to be shared
  // Create or find a DISSEC directory
  const baseFolder = 'DISSEC'
  const parentDirectory = { _id: 'io.cozy.files.root-dir', attributes: {} }

  try {
    const { data: appDirectory } = await client
      .collection('io.cozy.files')
      .getDirectoryOrCreate(baseFolder, parentDirectory)

    return appDirectory
  } catch (err) {
    if (err.status === 409) {
      const { data } = await client
        .collection('io.cozy.files')
        .statByPath(`/DISSEC`)
      return data
    } else {
      throw new Error(
        `Error while creating the app folder DISSEC: ${String(err)}`
      )
    }
  }
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
