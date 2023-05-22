import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Input from 'cozy-ui/react/Input'
import Label from 'cozy-ui/react/Label'
import { useClient, useQueryAll } from 'cozy-client'
import { nodesQuery, webhooksQuery, recentObservationsQuery } from 'lib/queries'
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
  const treeStructure = useMemo(() => ({ depth, fanout, groupSize }), [
    depth,
    fanout,
    groupSize
  ])
  const [tree, setTree] = useState()
  const observationsQuery = recentObservationsQuery(
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
  useEffect(() => {
    if (!tree || tree[0]?.treeStructure !== treeStructure)
      setTree(nodes && nodes.length > 0 ? createTree(treeStructure, nodes) : [])
  }, [nodes, tree, treeStructure])
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
    const transformNode = node => {
      if (!nodesMap[node.nodeId]) {
        nodesMap[node.nodeId] = { parents: [], children: [] }
        edgesMap[node.nodeId] = []
      }

      for (const parent of node.parents || []) {
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
        const role =
          n.level === 0
            ? 'Querier'
            : n.level === n.treeStructure.depth - 2
            ? 'Leaf'
            : n.level === n.treeStructure.depth - 1
            ? 'Contributor'
            : 'Aggregator'
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
          role,
          startedWorking: relatedObservations.length > 0,
          finishedWorking: relatedObservations.length === expectedMessages[role]
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
    setLastExecutionId(tree[0]?.executionId)
  }, [tree, treeStructure, supervisorWebhook, client.stackClient])

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
        {lastExecutionId === tree[0]?.executionId ? (
          <span className="full-agg-error">
            Regenerate the tree by changing a parameter to relaunch an execution
          </span>
        ) : null}
        <Button
          className="button-basic"
          iconOnly
          label="Launch execution"
          onClick={handleLaunchExecution}
          extension="narrow"
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
