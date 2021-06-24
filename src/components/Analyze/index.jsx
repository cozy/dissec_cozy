import React, { useCallback, useEffect, useState } from 'react'

import Spinner from 'cozy-ui/react/Spinner'
import Button from 'cozy-ui/react/Button'
import { queryConnect, useClient } from 'cozy-client'
import { sharesQuery } from 'doctypes'
import Webhook from './Webhook'
import Share from './Share'

export const Analyze = ({ shares }) => {
  const client = useClient()

  const [isWorking, setIsWorking] = useState(false)
  const [webhooks, setWebhooks] = useState()

  const { data } = shares

  const fetchWebhooks = useCallback(
    async () => {
      const webhooks = await client.stackClient.fetchJSON(
        'GET',
        '/jobs/triggers'
      )

      setWebhooks(
        webhooks.data
          .filter(hook => hook.attributes.type === '@webhook')
          .sort(hook => hook.attributes.message.name)
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

  const createWebhooks = useCallback(
    async () => {
      const createBody = argument => ({
        data: {
          attributes: {
            type: '@webhook',
            worker: 'service',
            arguments: argument
          }
        }
      })

      // Register contribution webhook
      await client.stackClient.fetchJSON(
        'POST',
        '/jobs/triggers',
        createBody('dissec.contribution')
      )

      // Register aggregation webhook
      await client.stackClient.fetchJSON(
        'POST',
        '/jobs/triggers',
        createBody('dissec.aggregation')
      )

      await fetchWebhooks()
    },
    [webhooks, client, fetchWebhooks]
  )

  useEffect(
    () => {
      if (webhooks && webhooks.length === 0) {
        createWebhooks()
      }
    },
    [webhooks, createWebhooks]
  )

  // delete the related todo
  const addDocument = useCallback(
    async () => {
      // display a spinner during the process
      setIsWorking(true)

      setIsWorking(false)
    },
    [data, client]
  )

  return (
    <div className="todos">
      {data.map((e, i) => (
        <Share key={i} share={e} />
      ))}
      {webhooks && webhooks.map(hook => <Webhook key={hook.id} hook={hook} />)}
      {isWorking ? (
        <Spinner size="xxlarge" middle />
      ) : (
        <div className="action-group">
          <Button
            className="todo-remove-button"
            theme="danger"
            //icon="delete"
            iconOnly
            label="Delete"
            busy={isWorking}
            disabled={isWorking}
            onClick={addDocument}
            extension="narrow"
          >
            Ajouter un doc
          </Button>
          <Button
            className="todo-remove-button"
            //theme="danger"
            iconOnly
            label="Create webhook"
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
export default queryConnect({
  shares: {
    query: sharesQuery,
    as: 'shares'
  }
})(Analyze)
