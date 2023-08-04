import React, { useCallback, useState } from 'react'
import { useClient } from 'cozy-client'
import Button from 'cozy-ui/transpiled/react/Buttons'
import Select from 'cozy-ui/transpiled/react/Select'
import Input from 'cozy-ui/transpiled/react/Input'
import Label from 'cozy-ui/transpiled/react/Label'
import MenuItem from 'cozy-ui/transpiled/react/MenuItem'
import { BANK_OPERATIONS_DOCTYPE } from 'doctypes'

import categories from 'assets/classes.json'
import { capitalizeFirstLetter } from 'lib/utils'
import Typography from 'cozy-ui/transpiled/react/Typography'

export const OperationAdd = () => {
  const client = useClient()

  const [operationToAdd, setOperationToAdd] = useState('')
  const [amountToAdd, setAmountToAdd] = useState(0)
  const [category, setCategory] = useState('0')
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

  const handleCategoryChange = useCallback(
    event => {
      setCategory(event.target.value)
    },
    [setCategory]
  )

  // create the new bank operation
  const handleSubmit = useCallback(
    async e => {
      e.preventDefault()

      // reset the input and display a spinner during the process
      setIsWorking(true)

      await client.create(BANK_OPERATIONS_DOCTYPE, {
        label: operationToAdd,
        amount: Number(amountToAdd),
        manualCategoryId: category || '0'
      })

      // remove the spinner
      setIsWorking(false)
      setOperationToAdd('')
      setAmountToAdd('')
    },
    [client, operationToAdd, amountToAdd, category]
  )

  return (
    <div>
      <Typography variant="h2">Add a new Operation</Typography>
      <span>
        Fill this form to create a new banking operation. The label is the data
        used to classify, the category is the target.
      </span>
      <form className="form-base">
        <div>
          <Label htmlFor="todo-add-input"> Operation label: </Label>
          <Input
            value={operationToAdd}
            onChange={handleLabelChange}
            id="todo-add-input"
          />
        </div>
        <div>
          <Label htmlFor="todo-add-input"> Operation amount: </Label>
          <Input
            value={amountToAdd}
            onChange={handleAmountChange}
            id="todo-add-input"
            type="number"
          />
        </div>
        <div>
          <div id="select-category-label">Category</div>
          <Select
            labelId="select-category-label"
            className="category-item"
            label="Category"
            value={category}
            onChange={handleCategoryChange}
            style={{ marginLeft: 0 }}
          >
            {Object.keys(categories).map(key => (
              <MenuItem key={key} value={key}>
                {capitalizeFirstLetter(categories[key])}
              </MenuItem>
            ))}
          </Select>
        </div>
        <div>
          <Button
            variant="primary"
            label="add"
            onClick={handleSubmit}
            busy={isWorking}
          />
        </div>
      </form>
    </div>
  )
}

// get mutations from the client to use createDocument
export default OperationAdd
