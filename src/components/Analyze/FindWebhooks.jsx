import React, { useCallback, useState } from 'react'

import Button from 'cozy-ui/react/Button'
import { useClient } from 'cozy-client'
import { Spinner } from 'cozy-ui/react/Spinner'

export const FindWebhooks = (props) => {
  const client = useClient()
  
  const [isWorking, setIsWorking] = useState(false)

  // delete the related todo
  const findHooks = useCallback(async () => {
    const { deleteDocument, todo } = props
    console.log(props)
    // display a spinner during the process
    setIsWorking(true)

    setTimeout(() => setIsWorking(false), 1000)
    // delete the todo in the Cozy : asynchronous
    // await deleteDocument(todo)
    // remove the spinner
    
    // We can omit that since this component will be
    // unmount after the document is deleted by the client
  }, [])

  return isWorking ? <Spinner size="xxlarge" middle /> : (
    <Button
      className="todo-remove-button"
      theme="danger"
      icon="delete"
      iconOnly
      label="Delete"
      busy={isWorking}
      disabled={isWorking}
      onClick={findHooks}
      extension="narrow"
    />
  )
}

// get mutations from the client to use deleteDocument
export default FindWebhooks
