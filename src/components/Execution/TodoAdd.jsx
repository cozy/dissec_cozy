import React, { Component, useCallback, useState } from 'react'

import { useClient } from 'cozy-client'
import Input from 'cozy-ui/react/Input'
import Label from 'cozy-ui/react/Label'
import Button from 'cozy-ui/react/Button'

import { TODOS_DOCTYPE } from 'doctypes'

export const TodoAdd = () => {
  const client = useClient()

  const [todoToAdd, setTodoToAdd] = useState('')
  const [isWorking, setIsWorking] = useState(false)

  // handle input value change
  const handleChange = useCallback(
    event => {
      console.log('change', event.target.value)
      setTodoToAdd(event.target.value)
    },
    [setTodoToAdd]
  )

  // create the new todo
  const handleSubmit = useCallback(async () => {
    // reset the input and display a spinner during the process
    setIsWorking(true)

    await client.create(TODOS_DOCTYPE, { name: todoToAdd })

    // remove the spinner
    setIsWorking(false)
    setTodoToAdd('')
  }, [todoToAdd, client, setTodoToAdd, setIsWorking])

  return (
    <div>
      <h2>Add a new Todo:</h2>
      <form onSubmit={handleSubmit}>
        <Label htmlFor="todo-add-input"> Todo name: </Label>
        <Input value={todoToAdd} onChange={handleChange} id="todo-add-input" />
        <Button
          //onClick={submit}
          type="submit"
          busy={isWorking}
          label="add"
          size="large"
          extension="narrow"
        />
      </form>
    </div>
  )
}

// get mutations from the client to use createDocument
export default TodoAdd
