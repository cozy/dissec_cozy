import React, { useCallback, useState } from 'react'

import Button from 'cozy-ui/transpiled/react/Buttons'
import { useClient } from 'cozy-client'

export const OperationRemoveButton = ({ operation }) => {
  const client = useClient()

  const [isWorking, setIsWorking] = useState(false)

  // delete the related todo
  const removeOperation = useCallback(async () => {
    // display a spinner during the process
    setIsWorking(true)
    // delete the todo in the Cozy : asynchronous
    await client.destroy(operation)
    // remove the spinner
    setIsWorking(false)
    // We can omit that since this component will be
    // unmount after the document is deleted by the client
  }, [operation, client, setIsWorking])

  return (
    <Button
      variant="primary"
      color="error"
      label="Delete"
      busy={isWorking}
      disabled={isWorking}
      onClick={removeOperation}
    />
  )
}

// get mutations from the client to use deleteDocument
export default OperationRemoveButton
