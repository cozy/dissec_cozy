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
import FullAggregation from './FullAggregation.jsx'
import SingleNodeAggregation from './SingleNodeAggregation'
import Webhook from './Webhook'

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
    <div>
      <FullAggregation
        supervisorWebhook={
          webhooks?.find(e => e.message.name === 'observe')?.links.webhook
        }
      />
      <SingleNodeAggregation />
      {webhooks &&
        webhooks.map(hook => (
          <Webhook key={hook.id} hook={hook} onUpdate={fetch} />
        ))}
      {isWorking ? (
        <Spinner size="xxlarge" middle />
      ) : (
        <div className="action-group">
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
    </div>
  )
}

// get data from the client state: data, fetchStatus
export default Execution
