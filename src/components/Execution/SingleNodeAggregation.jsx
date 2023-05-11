import { FormControlLabel, Switch } from '@material-ui/core'
import { useClient, useQueryAll } from 'cozy-client'
import Button from 'cozy-ui/react/Button'
import Input from 'cozy-ui/react/Input'
import Label from 'cozy-ui/react/Label'
import Spinner from 'cozy-ui/react/Spinner'
import SelectBox from 'cozy-ui/transpiled/react/SelectBox/SelectBox'
import React, { useCallback, useState } from 'react'
import { v4 as uuid } from 'uuid'
import createTree from 'lib/createTreeExported.js'
import { nodesQuery } from 'lib/queries'

const SingleNodeAggregation = () => {
  const client = useClient()
  const query = nodesQuery()
  const { data: nodes, isLoading } = useQueryAll(
    query.definition,
    query.options
  )
  const [nbShares, setNbShares] = useState(3)
  const [pretrained, setPretrained] = useState(true)
  const [node, setSingleNode] = useState()
  const [isWorking, setIsWorking] = useState(false)
  const treeStructure = { depth: 3, fanout: 1, groupSize: nbShares }
  const options = nodes?.map(e => ({ value: e, label: e.label || e.id }))

  const handleLaunchExecution = useCallback(async () => {
    setIsWorking(true)

    try {
      // Create a tree with one contributor, nbShares aggregators and one finalizer
      const contributors = createTree(treeStructure, [node], true)
      const executionId = uuid()

      for (const contributor of contributors) {
        const contributionBody = {
          ...contributor,
          executionId,
          pretrained,
          treeStructure,
          useTiny: true
        }
        await new Promise(resolve => {
          setTimeout(resolve, 1000)
        })
        await client.stackClient.fetchJSON(
          'POST',
          contributor.contributionWebhook,
          contributionBody
        )
      }
    } finally {
      setIsWorking(false)
    }
  }, [treeStructure, node, pretrained, client.stackClient])

  return isLoading ? (
    <Spinner size="xxlarge" middle />
  ) : (
    <div className="card">
      <div className="card-title">
        <b>Single node aggregation</b>
      </div>
      <div>
        Performs the distributed aggregation protocol using different processes
        of the same instance: the instance compute a local model, sends shares
        to itself, aggregates them and then does the final aggregation.
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
      <div className="selected-single-node">
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
          disabled={!node || isWorking}
          onClick={handleLaunchExecution}
          extension="narrow"
        >
          Launch execution
        </Button>
      </div>
    </div>
  )
}

export default SingleNodeAggregation
