import React, { useCallback, useState } from 'react'

import Label from 'cozy-ui/react/Label'
import Input from 'cozy-ui/react/Input'
import { Switch, FormControlLabel } from '@material-ui/core'
import Button from 'cozy-ui/react/Button'

import { useClient } from 'cozy-client'
import { v4 as uuid } from 'uuid'

export const SingleNodeAggregation = ({ node }) => {
  const client = useClient()

  const [isWorking, setIsWorking] = useState(false)
  const [nbShares, setNbShares] = useState(3)
  const [pretrained, setPretrained] = useState(true)

  const handleLaunchExecution = useCallback(
    async () => {
      setIsWorking(true)
      // Create a tree with one contributor, nbShares aggregators and one finalizer
      const parents = Array(nbShares)
        .fill()
        .map(() => ({
          level: 0,
          finalize: false,
          webhook: node.aggregationWebhook,
          parents: [{ level: 1, webhook: node.aggregationWebhook, finalize: true }]
        }))
      const contributionBody = {
        executionId: uuid(),
        pretrained,
        nbShares,
        parents
      }
      await client.stackClient.fetchJSON(
        'POST',
        node.contributionWebhook,
        contributionBody
      )
      setIsWorking(false)
    },
    [node, client, nbShares, setIsWorking]
  )

  return (
    <div className="selected-single-node">
      <div className="single-node-title">
        {node && (node.label ? node.label : node.id)}
      </div>
      <div>
        <Label htmlFor="single-node-shares">Number of shares: </Label>
        <Input
          value={nbShares}
          onChange={e => setNbShares(e.target.value)}
          id="single-node-shares"
        />
      </div>
      <FormControlLabel
        label="Use pretrained model?"
        control={
          <Switch
            checked={pretrained}
            onChange={() => setPretrained(old => !old)}
            name="Use pretrained model?"
          />
        }
      />
      <Button
        className="todo-remove-button"
        //theme="danger"
        iconOnly
        label="Launch execution"
        busy={isWorking}
        disabled={isWorking}
        onClick={handleLaunchExecution}
        extension="narrow"
      >
        Launch execution
      </Button>
    </div>
  )
}

export default SingleNodeAggregation
