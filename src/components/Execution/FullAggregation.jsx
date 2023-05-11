import { useClient, useQueryAll } from 'cozy-client'
import Button from 'cozy-ui/react/Button'
import Spinner from 'cozy-ui/react/Spinner'
import React, { useCallback, useState } from 'react'
import { v4 as uuid } from 'uuid'
import Label from 'cozy-ui/react/Label/index.jsx'
import Input from 'cozy-ui/react/Input/index.jsx'
import createTree from 'lib/createTreeExported.js'
import { nodesQuery } from 'lib/queries.js'

const FullAggregation = ({ supervisorWebhook }) => {
  const client = useClient()
  const query = nodesQuery()
  const { isLoading, data: nodes } = useQueryAll(
    query.definition,
    query.options
  )
  const [nbShares, setNbShares] = useState(2)
  const [nbContributors, setNbContributors] = useState(2)
  const treeStructure = {
    depth: 3,
    fanout: nbContributors,
    groupSize: nbShares
  }
  const [isWorking, setIsWorking] = useState(false)

  const handleLaunchExecution = useCallback(async () => {
    setIsWorking(true)

    try {
      const executionId = uuid()
      const contributors = createTree(treeStructure, nodes)

      for (const contributor of contributors) {
        const contributionBody = {
          ...contributor,
          executionId,
          pretrained: false,
          treeStructure,
          useTiny: true,
          supervisorWebhook
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
  }, [treeStructure, nodes, supervisorWebhook, client.stackClient])

  return isLoading ? (
    <Spinner size="xxlarge" middle />
  ) : (
    <div className="card">
      <div className="card-title">
        <b>Full aggregation</b>
      </div>
      <div className="full-agg-form">
        <div>
          <Label htmlFor="full-agg-contributors">
            Number of contributors:{' '}
          </Label>
          <Input
            value={nbContributors}
            onChange={e => setNbContributors(Number(e.target.value))}
            id="full-agg-contributors"
          />
        </div>
        <div>
          <Label htmlFor="full-agg-shares">Number of shares: </Label>
          <Input
            value={nbShares}
            onChange={e => setNbShares(Number(e.target.value))}
            id="full-agg-shares"
          />
        </div>
        <Button
          className="button-basic"
          //theme="danger"
          iconOnly
          label="Launch execution"
          busy={isWorking}
          disabled={
            isWorking || (nodes?.length || 0) < nbShares + nbContributors + 1
          }
          onClick={handleLaunchExecution}
          extension="narrow"
        >
          Launch execution
        </Button>
        {(nodes?.length || 0) < nbShares + nbContributors + 1 ? (
          <div className="full-agg-error">
            There are not enough nodes registered...
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default FullAggregation
