import React from 'react'
import Accordion from 'cozy-ui/transpiled/react/Accordion'
import AccordionDetails from 'cozy-ui/transpiled/react/AccordionDetails'
import AccordionSummary from 'cozy-ui/transpiled/react/AccordionSummary'
import Observation from './Observation'

export const ExecutionGroup = ({ group, title }) => {
  return (
    <Accordion style={{ width: '100%' }}>
      <AccordionSummary>
        {title} ({group.length} Observations)
      </AccordionSummary>
      <AccordionDetails style={{ flexWrap: 'wrap', width: '100%' }}>
        {group.map(item => (
          <Observation key={item._id} observation={item} />
        ))}
      </AccordionDetails>
    </Accordion>
  )
}
