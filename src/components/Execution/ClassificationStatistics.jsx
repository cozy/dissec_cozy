import React, { useMemo } from 'react'
import { useQuery } from 'cozy-client'
import Accordion from 'cozy-ui/transpiled/react/Accordion'
import AccordionDetails from 'cozy-ui/transpiled/react/AccordionDetails'
import AccordionSummary from 'cozy-ui/transpiled/react/AccordionSummary'
import Divider from 'cozy-ui/transpiled/react/Divider'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from 'cozy-ui/transpiled/react/Table'
import { capitalizeFirstLetter } from 'lib/utils'
import { latestCategorizationQuery } from 'lib/queries'
import classes from 'assets/classesTiny.json'
import Typography from 'cozy-ui/transpiled/react/Typography'

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
    <Accordion>
      <AccordionSummary>
        <Typography variant="h3">Classification statistics </Typography>
      </AccordionSummary>
      <AccordionDetails className="u-flex u-flex-column">
        <Typography variant="h5" className="u-pt-half u-ta-center">
          Latest classification: {latestCategorization?.cozyMetadata.updatedAt}
        </Typography>
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
