import React from 'react'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary
} from '@material-ui/core'
import Observation from './Observation'

export const ExecutionGroup = ({ group, title }) => {
  return (
    <Accordion className="execution-group">
      <AccordionSummary className="execution-summary">{title}</AccordionSummary>
      <AccordionDetails className="execution-details">
        {group.map(item => (
          <Observation key={item._id} observation={item} />
        ))}
      </AccordionDetails>
    </Accordion>
  )
}
