import { useClient, useQueryAll } from 'cozy-client'
import Button from 'cozy-ui/transpiled/react/Buttons'
import Spinner from 'cozy-ui/transpiled/react/Spinner'
import React, { useCallback, useState } from 'react'

import {
  SERVICE_CATEGORIZE,
  SERVICE_CONTRIBUTION,
  SERVICE_RECEIVE_SHARES,
  SERVICE_OBSERVE
} from 'targets/services/helpers'
import { webhooksQuery } from 'lib/queries'
import Webhook from './Webhook'
import Accordion from 'cozy-ui/transpiled/react/Accordion'
import AccordionSummary from 'cozy-ui/transpiled/react/AccordionSummary'
import AccordionDetails from 'cozy-ui/transpiled/react/AccordionDetails'
import Typography from 'cozy-ui/transpiled/react/Typography'
import ClassificationStatistics from './ClassificationStatistics'
import ClassifyOperations from './ClassifyOperations'

export const Execution = () => {
  const client = useClient()
  const query = webhooksQuery()
  const { data: webhooks } = useQueryAll(query.definition, query.options)
  const [isWorking, setIsWorking] = useState(false)

  const resetWebhooks = useCallback(async () => {
    setIsWorking(true)

    // Deleting old webhooks
    if (webhooks) {
      await Promise.all(
        webhooks.map(async webhook => await client.destroy(webhook))
      )
    }

    // Creating new ones
    await Promise.all(
      [
        SERVICE_CATEGORIZE,
        SERVICE_CONTRIBUTION,
        SERVICE_RECEIVE_SHARES,
        SERVICE_OBSERVE
      ].map(
        async name =>
          await client.create('io.cozy.triggers', {
            type: '@webhook',
            worker: 'service',
            message: {
              slug: 'dissecozy',
              name
            }
          })
      )
    )
    setIsWorking(false)
  }, [client, webhooks])

  return (
    <div className="u-p-half">
      <ClassifyOperations />
      <ClassificationStatistics />
      <Accordion>
        <AccordionSummary>
          <Typography variant="h3">Webhooks</Typography>
        </AccordionSummary>
        <AccordionDetails className="u-flex-column u-flex-items-center">
          {webhooks &&
            webhooks.map(hook => (
              <Webhook key={hook.id} hook={hook} onUpdate={fetch} />
            ))}
          {isWorking ? (
            <Spinner size="xxlarge" middle />
          ) : (
            <div className="u-m-half">
              <Button
                variant="primary"
                color="error"
                label="Reset webhooks"
                busy={isWorking}
                disabled={isWorking}
                onClick={resetWebhooks}
              />
            </div>
          )}
        </AccordionDetails>
      </Accordion>
    </div>
  )
}

// get data from the client state: data, fetchStatus
export default Execution
