import React, { useCallback, useEffect, useState } from 'react'

import Spinner from 'cozy-ui/react/Spinner'
import Button from 'cozy-ui/react/Button'
import { useClient } from 'cozy-client'
import Webhook from './Webhook'

export const Execution = () => {
  const client = useClient()

  const [isWorking, setIsWorking] = useState(false)
  const [webhooks, setWebhooks] = useState([])

  const createWebhooks = useCallback(
    async () => {
      const query = async name => {
        setIsWorking(true)

        client.stackClient.fetchJSON('POST', '/jobs/triggers', {
          data: {
            attributes: {
              type: '@webhook',
              worker: 'service',
              message: {
                slug: 'dissecozy',
                name: name
              }
            }
          }
        })
      }

      // Register categorization webhook
      await query('categorize')

      // Register contribution webhook
      await query('contribution')

      // Register aggregation webhook
      await query('aggregation')

      setTimeout(async () => {
        await fetchWebhooks()
        setIsWorking(false)
      }, 3000)
    },
    [client, fetchWebhooks]
  )

  const fetchWebhooks = useCallback(
    async () => {
      let webhooks = await client.stackClient.fetchJSON('GET', '/jobs/triggers')

      setWebhooks(
        webhooks.data
          .filter(hook => hook.attributes.type === '@webhook')
          .sort((a, b) => a.id > b.id)
      )
    },
    [client, setWebhooks]
  )

  useEffect(
    () => {
      fetchWebhooks()
    },
    [fetchWebhooks]
  )

  return (
    <div className="todos">
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
            //theme="danger"
            iconOnly
            label="Create webhooks"
            busy={isWorking}
            disabled={isWorking}
            onClick={createWebhooks}
            extension="narrow"
          >
            Créer un webhook
          </Button>
        </div>
      )}
    </div>
  )
}

// get data from the client state: data, fetchStatus
export default Execution
