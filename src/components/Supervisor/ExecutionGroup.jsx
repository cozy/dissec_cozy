import React from 'react'
import Accordion from 'cozy-ui/transpiled/react/Accordion'
import AccordionDetails from 'cozy-ui/transpiled/react/AccordionDetails'
import AccordionSummary from 'cozy-ui/transpiled/react/AccordionSummary'
import Observation from './Observation'

export const ExecutionGroup = ({ group, title }) => {
  return (
    <Accordion className="execution-group">
      <AccordionSummary className="execution-summary">
        {title} ({group.length} Observations)
      </AccordionSummary>
      <AccordionDetails className="execution-details">
        {group.map(item => (
          <Observation key={item._id} observation={item} />
        ))}
      </AccordionDetails>
    </Accordion>
  )
}
