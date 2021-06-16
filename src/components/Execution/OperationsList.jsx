import React from 'react'
import Accordion from '@material-ui/core/Accordion'
import AccordionSummary from '@material-ui/core/AccordionSummary'
import AccordionDetails from '@material-ui/core/AccordionDetails'
import { Divider } from '@material-ui/core'

import OperationRemoveButton from './OperationRemoveButton'

export const OperationsList = props => {
  const { operations } = props
  if (!operations || !operations.length) return null
  return (
    <div>
      <h2>Operations list:</h2>
      {operations.map(operation => (
        <Accordion key={operation._id} className="operation-item">
          <AccordionSummary>
            <div className="operation-text">
              <span>{operation.label}</span>
              {operation.amount >= 0 ? (
                <span className="operation-gain">{operation.amount}€</span>
              ) : (
                <span className="operation-spend">{operation.amount}€</span>
              )}
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
      ))}
    </div>
  )
}

export default OperationsList
