import React from 'react'
import { useQuery } from 'cozy-client'
import { latestCategorizationQuery } from 'lib/queries'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Divider
} from '@material-ui/core'
import { capitalizeFirstLetter } from 'lib/utils'
import classes from 'assets/classesTiny.json'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from 'cozy-ui/transpiled/react/Table'

const cellStyles = {
  flexGrow: 1
}

export const ClassificationStatistics = () => {
  const categorizationQuery = latestCategorizationQuery()
  const { data } = useQuery(
    categorizationQuery.definition,
    categorizationQuery.options
  )
  const [latestCategorization] = data || []

  return (
    <Accordion className="classes-changes-accordion">
      <AccordionSummary>
        <div className="operation-summary">
          <div className="operation-text">
            <h3 style={{ fontWeight: 'bold' }}>
              Latest classification:{' '}
              {latestCategorization?.cozyMetadata.updatedAt}
            </h3>
          </div>
        </div>
      </AccordionSummary>
      <AccordionDetails className="operation-details">
        <hr />
        <Divider />
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader style={cellStyles}>Class</TableHeader>
              <TableHeader style={cellStyles}>Delta</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {Object.entries(
              latestCategorization?.classificationChanges || {}
            ).map(([category, delta]) => (
              <TableRow
                key={category}
                style={{
                  backgroundColor:
                    category === '0' && delta > 0
                      ? '#FFCFCF'
                      : category === '0' && delta < 0
                      ? '#CFFFCF'
                      : '#FFFFFF'
                }}
              >
                <TableCell style={cellStyles}>
                  {capitalizeFirstLetter(classes[category])}
                </TableCell>
                <TableCell style={cellStyles}>{delta}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </AccordionDetails>
    </Accordion>
  )
}

export default ClassificationStatistics
