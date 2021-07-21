import React, { useCallback, useState } from 'react'

import Button from 'cozy-ui/react/Button'
import { useClient } from 'cozy-client'

export const NodeRemoveButton = ({ node }) => {
  const client = useClient()

  const [isWorking, setIsWorking] = useState(false)

  const removeNode = useCallback(
    async () => {
      setIsWorking(true)

      await client.destroy(node)

      setIsWorking(false)
    },
    [node, client, setIsWorking]
  )

  return (
    <Button
      className="todo-remove-button"
      theme="danger"
      label="Delete"
      size="large"
      busy={isWorking}
      disabled={isWorking}
      onClick={removeNode}
      extension="narrow"
    />
  )
}

export default NodeRemoveButton
