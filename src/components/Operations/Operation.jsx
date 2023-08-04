import Accordion from 'cozy-ui/transpiled/react/Accordion'
import AccordionSummary from 'cozy-ui/transpiled/react/AccordionSummary'
import AccordionDetails from 'cozy-ui/transpiled/react/AccordionDetails'
import TextField from 'cozy-ui/transpiled/react/TextField'
import Divider from 'cozy-ui/transpiled/react/Divider'
import FormControl from 'cozy-ui/transpiled/react/FormControl'
import Select from 'cozy-ui/transpiled/react/Select'
import MenuItem from 'cozy-ui/transpiled/react/MenuItem'
import { useClient } from 'cozy-client'
import React, { useCallback, useMemo, useState } from 'react'

import categories from 'assets/classes.json'
import { capitalizeFirstLetter } from 'lib/utils'
import OperationRemoveButton from './OperationRemoveButton'
import { CategoryIcon } from './CategoryIcon'
import arrowLeft from 'assets/icons/icon-arrow-left.svg'

export const Operation = ({ operation }) => {
  const client = useClient()
  const [category, setCategory] = useState(
    operation.previousCategoryId || operation.manualCategoryId || '0'
  )
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
      style={{
        border,
        borderRadius: '0.3rem'
      }}
    >
      <AccordionSummary>
        <div className="operation-summary">
          <div className="operation-text">
            <h3
              style={{
                fontWeight: 'bold',
                marginTop: '0',
                marginBottom: '0.5rem'
              }}
            >
              {operation.label}
            </h3>
            <span
              className={`${
                operation.amount >= 0 ? 'operation-gain' : 'operation-spend'
              }`}
            >
              {operation.amount}€
            </span>
          </div>
          <div className="category-info">
            <TextField
              className="u-caption"
              disabled
              label="Previous category"
              value={capitalizeFirstLetter(
                categories[
                  operation.previousCategoryId ||
                    operation.manualCategoryId ||
                    '0'
                ]
              )}
            />
            <div
              style={{
                display: 'flex',
                width: '100%',
                maxWidth: '8rem',
                padding: '0.5rem',
                justifyContent: 'space-around',
                alignItems: 'center'
              }}
            >
              <CategoryIcon category={category} width={32} height={32} />
              <svg
                width={24}
                height={24}
                style={{ transform: 'rotate(180deg)' }}
              >
                <use xlinkHref={`#${arrowLeft.id}`} />
              </svg>
              <CategoryIcon
                category={operation.cozyCategoryId || '0'}
                width={32}
                height={32}
              />
            </div>
            <TextField
              className="category-item"
              disabled
              label="Current category"
              value={capitalizeFirstLetter(
                categories[operation.cozyCategoryId || '0']
              )}
            />
          </div>
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
        <FormControl className="category-info">
          <div id="select-category-label">Manual category</div>
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
        <OperationRemoveButton operation={operation} />
      </AccordionDetails>
    </Accordion>
  )
}

export default Operation
