import React, { useCallback, useState } from 'react'

import Button from 'cozy-ui/react/Button'
import { useClient } from 'cozy-client'

export const NodeRemoveButton = ({ node }) => {
  const client = useClient()

  const [isWorking, setIsWorking] = useState(false)

  // delete the related todo
  const removeNode = useCallback(
    async () => {
      // display a spinner during the process
      setIsWorking(true)
      // delete the todo in the Cozy : asynchronous
      await client.destroy(node)
      // remove the spinner
      setIsWorking(false)
      // We can omit that since this component will be
      // unmount after the document is deleted by the client
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

// get mutations from the client to use deleteDocument
export default NodeRemoveButton
