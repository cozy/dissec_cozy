import { queryConnect, useClient } from 'cozy-client'
import Button from 'cozy-ui/react/Button'
import Spinner from 'cozy-ui/react/Spinner'
import React, { useCallback, useState } from 'react'
import { v4 as uuid } from 'uuid'
import createTree from '../../lib/createTreeExported.js'
import { nodesQuery } from '../../doctypes'
import Label from 'cozy-ui/react/Label/index.jsx'
import Input from 'cozy-ui/react/Input/index.jsx'

const FullAggregation = ({ nodes }) => {
  const client = useClient()

  const { isLoading, data } = nodes

  const [isWorking, setIsWorking] = useState(false)
  const [nbShares, setNbShares] = useState(2)
  const [nbContributors, setNbContributors] = useState(2)

  const handleLaunchExecution = useCallback(async () => {
    setIsWorking(true)

    try {
      const executionId = uuid()
      const treeStructure = [
        {
          numberOfNodes: 1
        },
        {
          numberOfNodes: nbShares
        },
        {
          numberOfNodes: nbContributors
        }
      ]
      const contributors = createTree(treeStructure, data)

      for (const contributor of contributors) {
        const contributionBody = {
          ...contributor,
          executionId,
          pretrained: false,
          nbShares,
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
  }, [nbShares, nbContributors, data, client.stackClient])

  return isLoading ? (
    <Spinner size="xxlarge" middle />
  ) : (
    <div className="card">
      <div className="card-title">
        <b>Full aggreation</b>
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
          disabled={isWorking || data.length < nbShares + nbContributors + 1}
          onClick={handleLaunchExecution}
          extension="narrow"
        >
          Launch execution
        </Button>
        {data.length < nbShares + nbContributors + 1 ? (
          <div className="full-agg-error">
            There are not enough nodes registered...
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default queryConnect({
  nodes: {
    query: nodesQuery,
    as: 'nodes'
  }
})(FullAggregation)
