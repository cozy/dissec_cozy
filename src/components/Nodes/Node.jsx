import React, { useState, useCallback } from 'react'
import { useClient } from 'cozy-client'

import Button from 'cozy-ui/react/Button'
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
      <div className="node-body">
        <Button
          className="node-contribution-button"
          onClick={handleContributionClick}
          busy={isWorking}
          disabled={isWorking}
          label="Launch Contribution"
          size="large"
        />
        <Button
          className="node-aggregation-button"
          onClick={handleAggregationClick}
          busy={isWorking}
          disabled={isWorking}
          label="Launch Aggregation"
          size="large"
        />
      </div>
      <NodeRemoveButton node={node} />
    </div>
  )
}

export default Node
