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
  const classChanges = Object.entries(classes).map(([k, v]) => ({
    className: capitalizeFirstLetter(v),
    before: (latestCategorization?.operationsCategoriesBefore || []).filter(
      e => e === k
    ).length,
    after: (latestCategorization?.operationsCategoriesAfter || []).filter(
      e => e === k
    ).length
  }))

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
              <TableHeader style={cellStyles}>Before</TableHeader>
              <TableHeader style={cellStyles}>After</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {classChanges
              .filter(e => e.before !== 0 || e.after !== 0)
              .map(change => (
                <TableRow
                  key={change.className}
                  style={{
                    backgroundColor:
                      change.before > change.after
                        ? '#FFCFCF'
                        : change.after > change.before
                        ? '#CFFFCF'
                        : '#FFFFFF'
                  }}
                >
                  <TableCell style={cellStyles}>{change.className}</TableCell>
                  <TableCell style={cellStyles}>{change.before}</TableCell>
                  <TableCell style={cellStyles}>{change.after}</TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </AccordionDetails>
    </Accordion>
  )
}

export default ClassificationStatistics
