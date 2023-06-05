import React, { useMemo } from 'react'
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
  console.log(latestCategorization, data)
  const changes = useMemo(() => {
    return Object.keys(classes)
      .map(c => {
        const before = latestCategorization?.categoriesBefore[c] || 0
        const after = latestCategorization?.categoriesAfter[c] || 0
        return { id: c, before, after }
      })
      .filter(e => e.before !== e.after || e.before !== 0)
  }, [latestCategorization])

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
              <TableHeader style={cellStyles}>Delta</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {changes.map(e => (
              <TableRow
                key={e.id}
                style={{
                  backgroundColor:
                    e.id === '0' && e.after - e.before > 0
                      ? '#FFCFCF'
                      : e.id === '0' && e.after - e.before < 0
                      ? '#CFFFCF'
                      : '#FFFFFF'
                }}
              >
                <TableCell style={cellStyles}>
                  {capitalizeFirstLetter(classes[e.id])}
                </TableCell>
                <TableCell style={cellStyles}>{e.before}</TableCell>
                <TableCell style={cellStyles}>{e.after}</TableCell>
                <TableCell style={cellStyles}>{e.after - e.before}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </AccordionDetails>
    </Accordion>
  )
}

export default ClassificationStatistics
