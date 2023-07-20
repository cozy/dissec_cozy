import React, { useState, useCallback } from 'react'
import { useClient } from 'cozy-client'

import Button from 'cozy-ui/transpiled/react/Buttons'
import NodeRemoveButton from './NodeRemoveButton'

export const Node = ({ node }) => {
  const client = useClient()

  const [isWorking, setIsWorking] = useState(false)

  const { label, contributionWebhook, aggregationWebhook } = node

  const handleContributionClick = useCallback(async () => {
    setIsWorking(true)
    await client.stackClient.fetchJSON('POST', contributionWebhook)
    setIsWorking(false)
  }, [client, contributionWebhook, setIsWorking])

  const handleAggregationClick = useCallback(async () => {
    setIsWorking(true)
    await client.stackClient.fetchJSON('POST', aggregationWebhook)
    setIsWorking(false)
  }, [client, aggregationWebhook, setIsWorking])

  return (
    <div className="node">
      <div className="node-label">
        <b>{label ? label : 'Unnamed node'}</b>
      </div>
      <div
        style={{ display: 'flex', gap: '1rem', margin: 'auto', padding: '5px' }}
      >
        <Button
          variant="primary"
          label="Launch Contribution"
          onClick={handleContributionClick}
          busy={isWorking}
          disabled={isWorking}
        />
        <Button
          variant="primary"
          label="Launch Aggregation"
          onClick={handleAggregationClick}
          busy={isWorking}
          disabled={isWorking}
        />
      </div>
      <NodeRemoveButton node={node} />
    </div>
  )
}

export default Node
