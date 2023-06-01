import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField
} from '@material-ui/core'
import { useClient } from 'cozy-client'
import React, { useCallback, useMemo, useState } from 'react'

import categories from 'assets/classes.json'
import { capitalizeFirstLetter } from 'lib/utils'
import OperationRemoveButton from './OperationRemoveButton'

export const Operation = ({ operation }) => {
  const client = useClient()
  const [category, setCategory] = useState(operation.manualCategoryId || '0')
  const border = useMemo(() => {
    const changed = operation.cozyCategoryId !== operation.previousCategoryId
    const isUncategorized = operation.cozyCategoryId === '0'
    const wasUncategorized = operation.previousCategoryId === '0'
    if (changed && isUncategorized) {
      return '0.2rem ridge orangered'
    } else if (changed && wasUncategorized && !isUncategorized) {
      return '0.2rem ridge lightgreen'
    } else if (changed) {
      return '0.2rem ridge lightgray'
    } else return ''
  }, [operation])

  const handleCategoryChange = useCallback(
    async e => {
      const uncategorized = e.target.value === '0'
      setCategory(e.target.value)
      await client.save({
        ...operation,
        manualCategoryId: uncategorized ? undefined : e.target.value
      })
    },
    [client, operation, setCategory]
  )

  return (
    <Accordion
      key={operation._id}
      className="operation-item"
      style={{
        border,
        borderRadius: '0.3rem'
      }}
    >
      <AccordionSummary>
        <div className="operation-summary">
          <div className="operation-text">
            <h3 style={{ fontWeight: 'bold' }}>{operation.label}</h3>
            {operation.amount >= 0 ? (
              <span className="operation-gain">{operation.amount}€</span>
            ) : (
              <span className="operation-spend">{operation.amount}€</span>
            )}
          </div>
          <FormControl className="category-info">
            <InputLabel id="select-category-label">Manual category</InputLabel>
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
            <TextField
              className="category-item"
              disabled
              label="Cozy category"
              value={capitalizeFirstLetter(
                categories[operation.cozyCategoryId || '0']
              )}
            />
          </FormControl>
        </div>
      </AccordionSummary>
      <AccordionDetails className="operation-details">
        <hr />
        <Divider />
        <ul>
          {Object.keys(operation).map(key => (
            <li key={key}>
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
