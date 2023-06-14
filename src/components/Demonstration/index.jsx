import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Input from 'cozy-ui/react/Input'
import Label from 'cozy-ui/react/Label'
import { useClient, useQueryAll } from 'cozy-client'
import {
  nodesQuery,
  webhooksQuery,
  observationsByExecutionQuery
} from 'lib/queries'
import createTree from 'lib/createTreeExported'
import TreeNetworkGraph from './TreeNetworkGraph'
import Spinner from 'cozy-ui/react/Spinner'
import { omit } from 'lodash'
import { Button } from 'cozy-ui/react/Button'
import NodesTable from './NodesTable'

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
  const [depth, setDepth] = useState(3)
  const [fanout, setFanout] = useState(3)
  const [groupSize, setGroupSize] = useState(2)
  const [lastExecutionId, setLastExecutionId] = useState()
  const [isRunning, setIsRunning] = useState(false)
  const treeStructure = useMemo(() => ({ depth, fanout, groupSize }), [
    depth,
    fanout,
    groupSize
  ])
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
  const [treeNodes, treeEdges] = useMemo(() => {
    if (!tree) return []

    const usedProperties = node => {
      return omit(node, ['parents'])
    }

    function onlyUnique(value, index, array) {
      return array.indexOf(value) === index
    }

    const nodesMap = {}
    const edgesMap = {}
    // Converting the tree used for the execution (starting from its leaves) to D3 compatible data
    const transformNode = node => {
      // Initialize the current node
      if (!nodesMap[node.nodeId]) {
        nodesMap[node.nodeId] = { parents: [], children: [] }
        edgesMap[node.nodeId] = []
      }

      // Converting parent(s)
      const index = node.group.indexOf(node.nodeId)
      // Select the appropriate parents
      const parents =
        (node.role === 'Leaf' ? [node.parents[index]] : node.parents) || []
      for (const parent of parents) {
        nodesMap[node.nodeId].parents = [
          ...nodesMap[node.nodeId].parents,
          parent.nodeId
        ].filter(onlyUnique)
        edgesMap[node.nodeId] = [
          ...edgesMap[node.nodeId],
          parent.nodeId
        ].filter(onlyUnique)

        transformNode(parent)
        nodesMap[parent.nodeId] = {
          ...nodesMap[parent.nodeId],
          children: [...nodesMap[parent.nodeId].children, node.nodeId].filter(
            onlyUnique
          )
        }
      }
      nodesMap[node.nodeId] = {
        ...nodesMap[node.nodeId],
        ...usedProperties(node)
      }
    }
    tree.forEach(transformNode)

    return [
      Object.values(nodesMap).map(n => {
        const relatedObservations = observations.filter(
          o => o.emitterId === n.nodeId || o.receiverId === n.nodeId
        )
        const expectedMessages = {
          Contributor: n.treeStructure.groupSize,
          Leaf: n.treeStructure.fanout + 1,
          Aggregator: n.treeStructure.fanout + 1,
          Querier: n.treeStructure.groupSize + 1
        }

        return {
          ...n,
          id: n.nodeId,
          startedWorking: relatedObservations.length > 0,
          finishedWorking:
            relatedObservations.length === expectedMessages[n.role]
        }
      }),
      Object.entries(edgesMap)
        .flatMap(([source, targets]) =>
          targets.map(target => ({ source, target }))
        )
        .map(e => {
          return {
            ...e,
            activeEdge: !!observations
              ?.filter(o => o.action !== 'receiveShare')
              ?.find(
                o =>
                  (o.receiverId === e.target && o.emitterId === e.source) ||
                  (o.receiverId === e.source && o.emitterId === e.target)
              )
          }
        })
    ]
  }, [observations, tree])

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

  const handleRegenerateTree = useCallback(() => {
    setTree(nodes && nodes.length > 0 ? createTree(treeStructure, nodes) : [])
  }, [nodes, treeStructure])

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
    <div>
      <div className="full-agg-form">
        <div>
          <Label htmlFor="full-agg-contributors">Depth: </Label>
          <Input
            value={depth}
            onChange={e => setDepth(Number(e.target.value))}
            id="full-agg-contributors"
          />
        </div>
        <div>
          <Label htmlFor="full-agg-contributors">Fanout: </Label>
          <Input
            value={fanout}
            onChange={e => setFanout(Number(e.target.value))}
            id="full-agg-contributors"
          />
        </div>
        <div>
          <Label htmlFor="full-agg-contributors">Group Size: </Label>
          <Input
            value={groupSize}
            onChange={e => setGroupSize(Number(e.target.value))}
            id="full-agg-contributors"
          />
        </div>
        <Button
          className="button-basic"
          iconOnly
          label="Regenerate tree"
          onClick={handleRegenerateTree}
          extension="narrow"
          disabled={lastExecutionId !== tree[0]?.executionId || isRunning}
        >
          Regenerate tree
        </Button>
        <Button
          className="button-basic"
          iconOnly
          label="Launch execution"
          onClick={handleLaunchExecution}
          extension="narrow"
          busy={isRunning}
          disabled={lastExecutionId === tree[0]?.executionId}
        >
          Launch execution
        </Button>
      </div>
      {treeNodes && treeEdges ? (
        <TreeNetworkGraph
          nodes={treeNodes}
          edges={treeEdges}
          width={400}
          height={400}
        />
      ) : null}
      <NodesTable nodes={treeNodes} />
    </div>
  )
}

export default Demonstration
