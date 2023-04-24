import { InputLabel, MenuItem, Select } from '@material-ui/core'
import { useClient } from 'cozy-client'
import Button from 'cozy-ui/react/Button'
import Input from 'cozy-ui/react/Input'
import Label from 'cozy-ui/react/Label'
import { BANK_DOCTYPE } from 'doctypes'
import React, { useCallback, useState } from 'react'

import categories from '../../assets/classes.json'
import { capitalizeFirstLetter } from '../../lib/utils'

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

      await client.create(BANK_DOCTYPE, {
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
      <h2>Add a new Operation:</h2>
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
          <InputLabel id="select-category-label">Category</InputLabel>
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
            onClick={handleSubmit}
            busy={isWorking}
            label="add"
            size="large"
            extension="full"
          />
        </div>
      </form>
    </div>
  )
}

// get mutations from the client to use createDocument
export default OperationAdd
