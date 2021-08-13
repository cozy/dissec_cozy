import React, { useCallback, useState } from 'react'

import { useClient } from 'cozy-client'
import Input from 'cozy-ui/react/Input'
import Label from 'cozy-ui/react/Label'
import Button from 'cozy-ui/react/Button'

import { BANK_DOCTYPE } from 'doctypes'

export const OperationAdd = () => {
  const client = useClient()

  const [operationToAdd, setOperationToAdd] = useState('')
  const [amountToAdd, setAmountToAdd] = useState(0)
  const [isWorking, setIsWorking] = useState(false)

  const handleLabelChange = useCallback(
    event => {
      setOperationToAdd(event.target.value)
    },
    [setOperationToAdd]
  )

  const handleAmountChange = useCallback(
    event => {
      setAmountToAdd(event.target.value)
    },
    [setAmountToAdd]
  )

  // create the new bank operation
  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault()

      // reset the input and display a spinner during the process
      setIsWorking(true)

      await client.create(BANK_DOCTYPE, {
        label: operationToAdd,
        amount: Number(amountToAdd)
      })

      // remove the spinner
      setIsWorking(false)
      setOperationToAdd('')
      setAmountToAdd('')
    },
    [
      operationToAdd,
      amountToAdd,
      client,
      setOperationToAdd,
      setAmountToAdd,
      setIsWorking
    ]
  )

  return (
    <div>
      <h2>Add a new Operation:</h2>
      <form>
        <Label htmlFor="todo-add-input"> Operation label: </Label>
        <Input
          value={operationToAdd}
          onChange={handleLabelChange}
          id="todo-add-input"
        />
        <Label htmlFor="todo-add-input"> Operation amount: </Label>
        <Input
          value={amountToAdd}
          onChange={handleAmountChange}
          id="todo-add-input"
          type="number"
        />
        <Button
          onClick={handleSubmit}
          busy={isWorking}
          label="add"
          size="large"
          //extension="narrow"
        />
      </form>
    </div>
  )
}

// get mutations from the client to use createDocument
export default OperationAdd
