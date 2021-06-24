import React, { useState, useCallback } from 'react'
import { useClient } from 'cozy-client'

import Accordion from '@material-ui/core/Accordion'
import AccordionSummary from '@material-ui/core/AccordionSummary'
import AccordionDetails from '@material-ui/core/AccordionDetails'
import {
  Divider,
  FormControl,
  Select,
  MenuItem,
  InputLabel
} from '@material-ui/core'

import OperationRemoveButton from './OperationRemoveButton'

import categories from '../../targets/services/helpers/classes.json'

const capitalizeFirstLetter = str => {
  return str.charAt(0).toUpperCase() + str.substring(1, str.length)
}

export const Operation = ({ operation }) => {
  const client = useClient()

  const [category, setCategory] = useState(operation.cozyCategoryId || '')

  const handleCategoryChange = useCallback(
    async e => {
      const uncategorized = e.target.value === '0'
      setCategory(e.target.value)
      await client.save({ ...operation, cozyCategoryId: uncategorized ? undefined : e.target.value })
    },
    [client, setCategory]
  )

  return (
    <Accordion key={operation._id} className="operation-item">
      <AccordionSummary>
        <div className="operation-summary">
          <div className="operation-text">
            <span>{operation.label}</span>
            {operation.amount >= 0 ? (
              <span className="operation-gain">{operation.amount}€</span>
            ) : (
              <span className="operation-spend">{operation.amount}€</span>
            )}
          </div>
          <FormControl variant="outlined">
            <InputLabel id="select-category-label">Category</InputLabel>
            <Select
              labelId="select-category-label"
              label="Category"
              value={category}
              onChange={handleCategoryChange}
            >
              {Object.keys(categories).map(key => (
                <MenuItem value={key}>
                  {capitalizeFirstLetter(categories[key])}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </div>
      </AccordionSummary>
      <AccordionDetails className="operation-details">
        <hr />
        <Divider />
        <ul>
          {Object.keys(operation).map(key => (
            <li>
              <span>
                <b>{key}</b>:{' '}
              </span>
              <span>{JSON.stringify(operation[key])}</span>
            </li>
          ))}
        </ul>
        <OperationRemoveButton operation={operation} />
      </AccordionDetails>
    </Accordion>
  )
}

export default Operation
