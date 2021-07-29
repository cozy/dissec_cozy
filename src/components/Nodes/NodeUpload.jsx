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
      console.log(file)

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

  const handleUpload = useCallback(
    async () => {
      for (let entry of entries) {
        await client.create(NODES_DOCTYPE, entry)
      }
    },
    [client, entries]
  )

  return (
    <div>
      <h2>Upload a list of node:</h2>
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
