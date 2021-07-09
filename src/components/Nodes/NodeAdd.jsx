import React, { useCallback, useState } from 'react'

import { useClient } from 'cozy-client'
import Input from 'cozy-ui/react/Input'
import Label from 'cozy-ui/react/Label'
import Button from 'cozy-ui/react/Button'

import { NODES_DOCTYPE } from 'doctypes'

export const AggregatorAdd = () => {
  const client = useClient()

  const [label, setLabel] = useState('')
  const [contributionWebhook, setContributionWebhook] = useState('')
  const [aggregationWebhook, setAggregationWebhook] = useState('')
  const [isWorking, setIsWorking] = useState(false)

  const handleLabelChange = useCallback(
    event => {
      setLabel(event.target.value)
    },
    [setLabel]
  )

  const handleContributionWebhookChange = useCallback(
    event => {
      setContributionWebhook(event.target.value)
    },
    [setContributionWebhook]
  )

  const handleAggregationWebhookChange = useCallback(
    event => {
      setAggregationWebhook(event.target.value)
    },
    [setAggregationWebhook]
  )

  // create the new todo
  const handleSubmit = useCallback(
    async () => {
      // reset the input and display a spinner during the process
      setIsWorking(true)

      await client.create(NODES_DOCTYPE, {
        label,
        contributionWebhook,
        aggregationWebhook
      })

      // remove the spinner
      setIsWorking(false)

      // Reset fields
      setLabel('')
      setContributionWebhook('')
      setAggregationWebhook('')
    },
    [
      label,
      contributionWebhook,
      aggregationWebhook,
      client,
      setIsWorking,
      setLabel,
      setContributionWebhook,
      setAggregationWebhook
    ]
  )

  return (
    <div>
      <h2>Add a new Node:</h2>
      <form className="node-form" onSubmit={e => e.preventDefault()}>
        <Label htmlFor="label-input">Node label (optionnal):</Label>
        <Input
          value={label}
          onChange={handleLabelChange}
          id="label-input"
        />
        <Label htmlFor="contribution-input">Contribution webhook:</Label>
        <Input
          value={contributionWebhook}
          onChange={handleContributionWebhookChange}
          id="contribution-input"
          type="url"
        />
        <Label htmlFor="aggregation-input">Aggregation webhook:</Label>
        <Input
          value={aggregationWebhook}
          onChange={handleAggregationWebhookChange}
          id="aggregation-input"
          type="url"
        />
        <Button
          className="add-node-button"
          onClick={handleSubmit}
          busy={isWorking}
          label="add"
          size="large"
        />
      </form>
    </div>
  )
}

// get mutations from the client to use createDocument
export default AggregatorAdd
