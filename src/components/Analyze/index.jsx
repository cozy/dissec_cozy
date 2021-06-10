import React, { useCallback, useEffect, useState } from 'react'

import Spinner from 'cozy-ui/react/Spinner'
import Button from 'cozy-ui/react/Button'
import { queryConnect, useClient, TriggerCollection } from 'cozy-client'
import { sharesQuery, DISSEC_DOCTYPE } from 'doctypes'
import Webhook from './Webhook'

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

      console.log(
        'effect',
        webhooks,
        webhooks.data.map(hook => hook.attributes.type),
        webhooks.data.filter(hook => hook.attributes.type === '@webhook')
      )

      setWebhooks(
        webhooks.data.filter(hook => hook.attributes.type === '@webhook')
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
    },
    [webhooks, client]
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

      await client.create(DISSEC_DOCTYPE, { test: data.length })

      setIsWorking(false)
    },
    [data, client]
  )

  const callWebhook = useCallback(
    async (hook, data) => {
      await client.stackClient.fetchJSON(
        'POST',
        `/jobs/webhooks/${hook.id}`,
        data
      )
    },
    [data, client, setIsWorking, fetchWebhooks]
  )

  return (
    <div className="todos">
      {data.map((e, i) => (
        <div key={i}><span>{JSON.stringify(e)}</span></div>
      ))}
      {webhooks && webhooks.map(hook => (
        <Webhook key={hook.id} hook={hook} callWebhook={callWebhook} />
      ))}
      {isWorking ? (
        <Spinner size="xxlarge" middle />
      ) : (
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
      )}
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
  )
}

// get data from the client state: data, fetchStatus
export default queryConnect({
  shares: {
    query: sharesQuery,
    as: 'shares'
  }
})(Analyze)
