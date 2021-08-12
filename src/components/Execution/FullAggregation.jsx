import React, { useCallback, useState, useMemo } from 'react'

import Label from 'cozy-ui/react/Label'
import Input from 'cozy-ui/react/Input'
import { Switch, FormControlLabel } from '@material-ui/core'
import Button from 'cozy-ui/react/Button'

import { useClient } from 'cozy-client'
import { v4 as uuid } from 'uuid'

const FullAggregation = ({ nodes, webhooks }) => {
  const client = useClient()

  const [isWorking, setIsWorking] = useState(false)
  const [contributors, setContributors] = useState()

  const handleGenerateTree = useCallback(
    async () => {
      setIsWorking(true)

      console.log(nodes)

      console.log(webhooks.filter(webhook => webhook.attributes.message.name === "receiveShares")[0].links.webhook)

      if(!webhooks) return

      let querier = {
        webhook: webhooks.filter(webhook => webhook.attributes.message.name === "receiveShares")[0].links.webhook,
        level: 0,
        nbChild: 3,
        aggregatorId: uuid(),
        finalize: true
      }

      let aggregators = [
        {
          webhook: nodes[0].aggregationWebhook,
          level: 1,
          nbChild: 7,
          parent: querier,
          aggregatorId: uuid(),
          finalize: false
        },
        {
          webhook: nodes[1].aggregationWebhook,
          level: 1,
          nbChild: 7,
          parent: querier,
          aggregatorId: uuid(),
          finalize: false
        },
        {
          webhook: nodes[2].aggregationWebhook,
          level: 1,
          nbChild: 7,
          parent: querier,
          aggregatorId: uuid(),
          finalize: false
        }
      ]

      let contributors = [
        { ...nodes[3], level: 2, nbChild: 0, parents: aggregators },
        { ...nodes[4], level: 2, nbChild: 0, parents: aggregators },
        { ...nodes[5], level: 2, nbChild: 0, parents: aggregators },
        { ...nodes[6], level: 2, nbChild: 0, parents: aggregators },
        { ...nodes[7], level: 2, nbChild: 0, parents: aggregators },
        { ...nodes[8], level: 2, nbChild: 0, parents: aggregators },
        { ...nodes[9], level: 2, nbChild: 0, parents: aggregators }
      ]

      setContributors(contributors)

      setIsWorking(false)
    },
    [nodes, webhooks, client, setIsWorking, setContributors]
  )

  const handleLaunchExecution = useCallback(
    async () => {
      if (!contributors) return

      console.log('Launching execution')

      setIsWorking(true)

      const executionId = uuid()

      function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms))
      }
      for (let contributor of contributors) {
        const contributionBody = {
          executionId,
          pretrained: false,
          nbShares: 3,
          parents: contributor.parents
        }

        // Queue request to avoid overlapping I/O
        await sleep(10000)
        await client.stackClient.fetchJSON(
          'POST',
          contributor.contributionWebhook,
          contributionBody
        )
      }

      setIsWorking(false)
    },
    [contributors, client, setIsWorking]
  )

  return (
    <div className="selected-single-node">
      <div className="single-node-title">Preview</div>
      <div>
        <p>Cool preview here</p>
      </div>
      <Button
        className="button-basic"
        //theme="danger"
        iconOnly
        label="Launch execution"
        busy={isWorking}
        disabled={isWorking}
        onClick={handleGenerateTree}
        extension="narrow"
      >
        Generate new tree
      </Button>
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

export default FullAggregation
