import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useClient, useQueryAll } from 'cozy-client'
import {
  nodesQuery,
  webhooksQuery,
  observationsByExecutionQuery
} from 'lib/queries'
import createTree from 'lib/createTreeExported'
import TreeNetworkGraph from './TreeNetworkGraph'
import Spinner from 'cozy-ui/react/Spinner'
import Button from 'cozy-ui/transpiled/react/Buttons'
import NodesTable from './NodesTable'
import TreeCreator from './TreeCreator'

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
  const [tree, setTree] = useState([])
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
  const [treeNodes, setTreeNodesState] = useState()
  const [treeEdges, setTreeEdgesState] = useState()
  const treeStructure = useMemo(() => {
    return treeNodes && treeNodes[0] ? treeNodes[0].treeStructure : undefined
  }, [treeNodes])

  const setTreeNodes = useCallback(n => {
    setTreeNodesState(n)
  }, [])
  const setTreeEdges = useCallback(n => {
    setTreeEdgesState(n)
  }, [])

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
    if (!tree || tree[0]?.treeStructure !== treeStructure)
      setTree(nodes && nodes.length > 0 ? createTree(treeStructure, nodes) : [])
  }, [nodes, tree, treeStructure])

  return !nodes || isLoading ? (
    <Spinner size="xxlarge" middle />
  ) : (
    <div className="u-p-half">
      <TreeCreator
        busy={false}
        setTreeNodes={setTreeNodes}
        setTreeEdges={setTreeEdges}
      />
      <Button
        className="u-m-auto"
        style={{ display: 'flex' }}
        variant="ghost"
        color="success"
        label="Launch execution"
        onClick={handleLaunchExecution}
        busy={isRunning}
        disabled={lastExecutionId === tree[0]?.executionId}
      />
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
