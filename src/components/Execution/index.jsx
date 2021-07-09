import React, { useCallback, useEffect, useState } from 'react'
import { queryConnect, useClient } from 'cozy-client'
import { nodesQuery } from 'doctypes'

import SelectBox from 'cozy-ui/transpiled/react/SelectBox'
import Spinner from 'cozy-ui/react/Spinner'
import Button from 'cozy-ui/react/Button'

import Webhook from './Webhook'
import SingleNodeAggregation from './SingleNodeAggregation'

export const Execution = ({ nodes }) => {
  const client = useClient()

  const { isLoading, data } = nodes
  const options = data.map(e => ({ value: e, label: e.id }))

  const [isWorking, setIsWorking] = useState(false)
  const [webhooks, setWebhooks] = useState([])
  const [singleNode, setSingleNode] = useState(data[0])

  const createWebhooks = useCallback(
    async () => {
      const query = async argument => {
        setIsWorking(true)

        client.stackClient.fetchJSON('POST', '/jobs/triggers', {
          data: {
            attributes: {
              type: '@webhook',
              worker: 'service',
              message: {
                slug: 'dissecozy',
                name: argument
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

  const handleSelectNode = useCallback(() => {}, [])

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
      {isLoading ? (
        <Spinner size="xxlarge" middle />
      ) : (
        <div className="single-node">
          <SelectBox
            options={options}
            name="Select a node"
            onChange={e => setSingleNode(e.value)}
          />
          <SingleNodeAggregation node={singleNode} />
        </div>
      )}
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
export default queryConnect({
  nodes: {
    query: nodesQuery,
    as: 'nodes'
  }
})(Execution)
