import React, { useCallback, useState } from 'react'

import Button from 'cozy-ui/transpiled/react/Buttons'
import { useClient } from 'cozy-client'

export const NodeRemoveButton = ({ node }) => {
  const client = useClient()

  const [isWorking, setIsWorking] = useState(false)

  const removeNode = useCallback(async () => {
    setIsWorking(true)

    await client.destroy(node)

    setIsWorking(false)
  }, [node, client, setIsWorking])

  return (
    <div style={{ margin: 'auto', padding: '5px', width: '100%' }}>
      <Button
        variant="primary"
        color="error"
        label="Delete"
        busy={isWorking}
        disabled={isWorking}
        onClick={removeNode}
      />
    </div>
  )
}

export default NodeRemoveButton
