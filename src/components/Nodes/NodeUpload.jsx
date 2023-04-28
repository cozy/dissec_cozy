import React, { useCallback, useState } from 'react'

import { useClient } from 'cozy-client'
import FileInput from 'cozy-ui/transpiled/react/FileInput'
import Label from 'cozy-ui/react/Label'
import Button from 'cozy-ui/react/Button'

import { NODES_DOCTYPE } from 'doctypes'

export const NodeUpload = () => {
  const client = useClient()

  const [entries, setEntries] = useState()
  const [isWorking, setIsWorking] = useState(false)

  const handleFileChange = useCallback(
    async file => {
      const reader = new FileReader()
      const content = await new Promise((resolve, reject) => {
        reader.onload = event => resolve(event.target.result)
        reader.onerror = error => reject(error)
        reader.readAsText(file)
      })

      setEntries(JSON.parse(content))
    },
    [setEntries]
  )

  const handleUpload = useCallback(async () => {
    setIsWorking(true)
    for (const entry of entries) {
      await client.create(NODES_DOCTYPE, entry)
    }
    setIsWorking(false)
  }, [client, entries])

  return (
    <div>
      <h2>Upload a list of node</h2>
      <span>
        Use this section to upload a list of nodes created by the population
        scripts to this instance. Useful if this instance was not selected as
        the supervisor during the population.
      </span>
      <form className="node-form" onSubmit={e => e.preventDefault()}>
        <Label htmlFor="aggregation-input">JSON File:</Label>
        <FileInput hidden={false} onChange={handleFileChange} />
        {entries && `Found ${entries.length} entries`}
        <Button
          className="upload-node-button"
          onClick={handleUpload}
          busy={isWorking}
          label="Upload"
          size="large"
        />
      </form>
    </div>
  )
}

export default NodeUpload
