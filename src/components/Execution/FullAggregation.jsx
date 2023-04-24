import { queryConnect, useClient } from 'cozy-client'
import Button from 'cozy-ui/react/Button'
import Spinner from 'cozy-ui/react/Spinner'
import React, { useCallback, useEffect, useState } from 'react'
import { v4 as uuid } from 'uuid'

import { nodesQuery } from '../../doctypes'
import { SERVICE_RECEIVE_SHARES } from '../../targets/services/helpers'

const FullAggregation = ({ nodes, webhooks }) => {
  const client = useClient()

  const { isLoading, data } = nodes

  const [isWorking, setIsWorking] = useState(false)
  const [contributors, setContributors] = useState()

  const handleGenerateTree = useCallback(async () => {
    if (!webhooks) return

    setIsWorking(true)

    let querier = {
      webhook: webhooks.filter(
        webhook => webhook.attributes.message.name === SERVICE_RECEIVE_SHARES
      )[0].links.webhook,
      level: 0,
      nbChild: 3,
      aggregatorId: uuid(),
      finalize: true
    }

    let aggregators = [
      {
        webhook: data[0].aggregationWebhook,
        level: 1,
        nbChild: 7,
        parent: querier,
        aggregatorId: uuid(),
        finalize: false
      },
      {
        webhook: data[1].aggregationWebhook,
        level: 1,
        nbChild: 7,
        parent: querier,
        aggregatorId: uuid(),
        finalize: false
      },
      {
        webhook: data[2].aggregationWebhook,
        level: 1,
        nbChild: 7,
        parent: querier,
        aggregatorId: uuid(),
        finalize: false
      }
    ]

    let contributors = [
      { ...data[3], level: 2, nbChild: 0, parents: aggregators },
      { ...data[4], level: 2, nbChild: 0, parents: aggregators },
      { ...data[5], level: 2, nbChild: 0, parents: aggregators },
      { ...data[6], level: 2, nbChild: 0, parents: aggregators },
      { ...data[7], level: 2, nbChild: 0, parents: aggregators },
      { ...data[8], level: 2, nbChild: 0, parents: aggregators },
      { ...data[9], level: 2, nbChild: 0, parents: aggregators }
    ]

    setContributors(contributors)

    setIsWorking(false)
  }, [data, webhooks, setIsWorking, setContributors])

  useEffect(() => {
    if (!contributors && webhooks.length !== 0) handleGenerateTree()
  }, [webhooks, contributors, handleGenerateTree])

  const handleLaunchExecution = useCallback(async () => {
    if (!contributors) return

    setIsWorking(true)

    const executionId = uuid()

    for (const contributor of contributors) {
      const contributionBody = {
        executionId,
        pretrained: false,
        nbShares: 3,
        parents: contributor.parents
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

    setIsWorking(false)
  }, [contributors, client, setIsWorking])

  return isLoading ? (
    <Spinner size="xxlarge" middle />
  ) : (
    <div className="selected-single-node">
      <div className="single-node-title">Actions</div>
      <Button
        className="button-basic"
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

export default queryConnect({
  nodes: {
    query: nodesQuery,
    as: 'nodes'
  }
})(FullAggregation)
