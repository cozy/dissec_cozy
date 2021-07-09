import React, { useCallback, useState } from 'react'

import Label from 'cozy-ui/react/Label'
import Input from 'cozy-ui/react/Input'
import { Switch, FormControlLabel } from '@material-ui/core'
import Button from 'cozy-ui/react/Button'

import { useClient } from 'cozy-client'

export const SingleNodeAggregation = ({ node }) => {
  const client = useClient()

  const [isWorking, setIsWorking] = useState(false)
  const [nbShares, setNbShares] = useState(1)
  const [pretrained, setPretrained] = useState(true)

  const handleLaunchExecution = useCallback(
    async () => {
      setIsWorking(true)
      // Create a tree with one contributor, nbShares aggregators and one finalizer
      const parents = Array(nbShares)
        .fill()
        .map(() => ({
          webhook: node.aggregationWebhook,
          finalize: false,
          parents: [{ webhook: aggregationWebhook, finalize: true }]
        }))
      const contributionBody = {
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
    [node, client, setIsWorking]
  )

  return (
    <div className="webhook">
      <div className="single-node-title">
        {node && (node.label ? node.label : node.id)}
      </div>
      <Label htmlFor="tsingle-node-shares">Number of shares: </Label>
      <Input
        value={shares}
        onChange={e => setNbShares(e.target.value)}
        id="single-node-shares"
      />
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
