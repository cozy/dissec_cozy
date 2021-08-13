import React, { useCallback, useEffect, useState } from 'react'
import { queryConnect, useClient } from 'cozy-client'
import { nodesQuery } from 'doctypes'

import SelectBox from 'cozy-ui/transpiled/react/SelectBox'
import Spinner from 'cozy-ui/react/Spinner'
import Label from 'cozy-ui/transpiled/react/Label'
import Button from 'cozy-ui/react/Button'

import Webhook from './Webhook'
import SingleNodeAggregation from './SingleNodeAggregation'
import FullAggregation from './FullAggregation.jsx'


export const Execution = ({ nodes }) => {
  const client = useClient()

  const { isLoading, data } = nodes
  const options = data.map(e => ({ value: e, label: e.id }))

  const [isWorking, setIsWorking] = useState(false)
  const [webhooks, setWebhooks] = useState([])
  const [singleNode, setSingleNode] = useState(data[0])

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
      let { data: webhooks } = await client.collection('io.cozy.triggers').all()
      console.log(webhooks)

      setWebhooks(
        webhooks
          .filter(hook => hook.type === '@webhook')
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
        <>
          <div className="card">
            <div className="card-title">
              <b>Full aggreation</b>
            </div>
            <FullAggregation nodes={data} webhooks={webhooks}/>
          </div>
          <div className="card">
            <div className="card-title">
              <b>Single node aggregation</b>
            </div>
            <div>
              <Label htmlFor="single-node-selector">
                Select the node performing the execution:{' '}
              </Label>
              <SelectBox
                id="single-node-selector"
                options={options}
                name="Select a node"
                onChange={e => setSingleNode(e.value)}
              />
            </div>
            <div className="spacer-sm" />
            {singleNode && <SingleNodeAggregation node={singleNode} />}
          </div>
        </>
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
