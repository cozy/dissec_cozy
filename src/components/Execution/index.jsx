import { useClient, useQuery } from 'cozy-client'
import Button from 'cozy-ui/react/Button'
import Spinner from 'cozy-ui/react/Spinner'
import React, { useCallback, useEffect, useState } from 'react'

import {
  SERVICE_CATEGORIZE,
  SERVICE_CONTRIBUTION,
  SERVICE_RECEIVE_SHARES
} from 'targets/services/helpers'
import { webhooksQuery } from 'lib/queries'
import FullAggregation from './FullAggregation.jsx'
import SingleNodeAggregation from './SingleNodeAggregation'
import Webhook from './Webhook'

export const Execution = () => {
  const client = useClient()
  const query = webhooksQuery()
  const { fetch } = useQuery(query.definition, query.options)
  const [webhooks, setWebhooks] = useState()
  const [isWorking, setIsWorking] = useState(false)

  // FIXME: Using useEffect should not be necessary if useQuery correctly refreshed
  useEffect(() => {
    ;(async () => {
      const { data } = await fetch()
      setWebhooks(data)
    })()
  })

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
      [SERVICE_CATEGORIZE, SERVICE_CONTRIBUTION, SERVICE_RECEIVE_SHARES].map(
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
    <div className="todos">
      <FullAggregation />
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
            className="todo-remove-button"
            theme="danger"
            iconOnly
            label="Create webhooks"
            busy={isWorking}
            disabled={isWorking}
            onClick={resetWebhooks}
            extension="narrow"
          >
            Reset webhooks
          </Button>
        </div>
      )}
    </div>
  )
}

// get data from the client state: data, fetchStatus
export default Execution
