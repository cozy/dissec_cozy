import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useClient, useQueryAll } from 'cozy-client'
import {
  nodesQuery,
  webhooksQuery,
  observationsByExecutionQuery
} from 'lib/queries'
import TreeNetworkGraph from './TreeNetworkGraph'
import Spinner from 'cozy-ui/react/Spinner'
import Button from 'cozy-ui/transpiled/react/Buttons'
import NodesTable from './NodesTable'
import TreeCreator from './TreeCreator'
import useTree from '../hooks/useTree'

const Demonstration = () => {
  const client = useClient()
  const query = nodesQuery()
  const { data: nodes, isLoading } = useQueryAll(
    query.definition,
    query.options
  )
  const { data: webhooks } = useQueryAll(
    webhooksQuery().definition,
    webhooksQuery().options
  )
  const supervisorWebhook = webhooks?.find(e => e.message.name === 'observe')
    ?.links.webhook
  const [lastExecutionId, setLastExecutionId] = useState()
  const [isRunning, setIsRunning] = useState(false)
  const observationsQuery = observationsByExecutionQuery(
    tree ? tree[0]?.executionId : undefined
  )
  const { data: rawObservations } = useQueryAll(
    observationsQuery.definition,
    observationsQuery.options
  )
  const observations = useMemo(
    () => (rawObservations || []).filter(o => o.action !== 'receiveShare'),
    [rawObservations]
  )
  const [treeStructure, setTreeStructure] = useState()
  const { treeNodes, treeEdges, tree, regenerateTree } = useTree({
    treeStructure
  })

  const handleLaunchExecution = useCallback(async () => {
    setIsRunning(true)
    setLastExecutionId(tree[0]?.executionId)
    for (const contributor of tree) {
      const contributionBody = {
        ...contributor,
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
  }, [tree, treeStructure, supervisorWebhook, client.stackClient])

  const handleStructureChange = useCallback(
    newStructure => {
      if (
        treeStructure?.depth !== newStructure?.depth ||
        treeStructure?.fanout !== newStructure?.fanout ||
        treeStructure?.groupSize !== newStructure?.groupSize
      ) {
        setTreeStructure(newStructure)
        regenerateTree()
      }
    },
    [regenerateTree, treeStructure]
  )

  // Waiting for the execution to finish
  useEffect(() => {
    if (
      observations.filter(
        observation =>
          observation.action === 'aggregation' && observation.payload.finished
      ).length > 0
    ) {
      setIsRunning(false)
    }
  }, [observations])

  // Recompute tree
  useEffect(() => {
    if (!tree || tree[0]?.treeStructure !== treeStructure) regenerateTree()
  }, [nodes, regenerateTree, tree, treeStructure])

  return !nodes || isLoading ? (
    <Spinner size="xxlarge" middle />
  ) : (
    <div className="u-p-half">
      <TreeCreator busy={isLoading} setTreeStructure={handleStructureChange} />
      <div className="u-flex u-flex-justify-around u-m-auto">
        <Button
          variant="ghost"
          label="Recreate tree"
          onClick={regenerateTree}
          disabled={isRunning}
        />
        <Button
          style={{ display: 'flex' }}
          variant="ghost"
          color="success"
          label="Launch execution"
          onClick={handleLaunchExecution}
          busy={isRunning}
          disabled={lastExecutionId === tree[0]?.executionId}
        />
      </div>
      {treeNodes && treeEdges ? (
        <TreeNetworkGraph
          nodes={treeNodes}
          edges={treeEdges}
          width={400}
          height={400}
        />
      ) : null}
      {treeNodes ? <NodesTable nodes={treeNodes} /> : null}
    </div>
  )
}

export default Demonstration
