import React, { Component, useCallback, useState } from 'react'

import Button from 'cozy-ui/react/Button'
import { useClient } from 'cozy-client'

export const TodoRemoveButton = ({ todo }) => {
  const client = useClient()

  const [isWorking, setIsWorking] = useState(false)

  // delete the related todo
  const removeTodo = useCallback(async () => {
    // display a spinner during the process
    setIsWorking(true)
    // delete the todo in the Cozy : asynchronous
    await client.destroy(todo)
    // remove the spinner
    setIsWorking(false)
    // We can omit that since this component will be
    // unmount after the document is deleted by the client
  }, [todo, client, setIsWorking])

  return (
    <Button
      className="todo-remove-button"
      theme="danger"
      icon="delete"
      iconOnly
      label="Delete"
      busy={isWorking}
      disabled={isWorking}
      onClick={removeTodo}
      extension="narrow"
    />
  )
}

// get mutations from the client to use deleteDocument
export default TodoRemoveButton
