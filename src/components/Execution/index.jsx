import { queryConnect, useClient } from 'cozy-client'
import Button from 'cozy-ui/react/Button'
import Spinner from 'cozy-ui/react/Spinner'
import { nodesQuery } from 'doctypes'
import React, { useCallback, useEffect, useState } from 'react'

import { TRIGGERS_DOCTYPE } from '../../doctypes/triggers'
import { SERVICE_CATEGORIZE, SERVICE_CONTRIBUTION, SERVICE_RECEIVE_SHARES } from '../../targets/services/helpers'
import FullAggregation from './FullAggregation.jsx'
import SingleNodeAggregation from './SingleNodeAggregation'
import Webhook from './Webhook'

export const Execution = () => {
  const client = useClient()

  const [isWorking, setIsWorking] = useState(false)
  const [webhooks, setWebhooks] = useState([])

  const fetchWebhooks = useCallback(async () => {
    let { data: webhooks } = await client.collection(TRIGGERS_DOCTYPE).all()

    setWebhooks(
      webhooks
        .filter(hook => hook.type === '@webhook')
        .sort((a, b) => a.id > b.id)
    )
  }, [client, setWebhooks])

  useEffect(() => {
    fetchWebhooks()
  }, [fetchWebhooks])

  const resetWebhooks = useCallback(async () => {
    setIsWorking(true)

    const { data: oldWebhooks } = await client
      .collection(TRIGGERS_DOCTYPE)
      .find({ type: '@webhook' })
    await Promise.all(
      oldWebhooks.map(async webhook => await client.destroy(webhook))
    )

    const query = async name => {
      await client.create('io.cozy.triggers', {
        type: '@webhook',
        worker: 'service',
        message: {
          slug: 'dissecozy',
          name: name
        }
      })
    }

    // Register categorization webhook
    await query(SERVICE_CATEGORIZE)

    // Register contribution webhook
    await query(SERVICE_CONTRIBUTION)

    // Register aggregation webhook
    await query(SERVICE_RECEIVE_SHARES)

    setTimeout(async () => {
      await fetchWebhooks()
      setIsWorking(false)
    }, 3000)
  }, [client, fetchWebhooks])

  return (
    <div className="todos">
      <>
        <div className="card">
          <div className="card-title">
            <b>Full aggreation</b>
          </div>
          <FullAggregation webhooks={webhooks} />
        </div>
        <SingleNodeAggregation />
      </>
      {webhooks &&
        webhooks.map(hook => (
          <Webhook key={hook.id} hook={hook} onUpdate={fetchWebhooks} />
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
export default queryConnect({
  nodes: {
    query: nodesQuery,
    as: 'nodes'
  }
})(Execution)
