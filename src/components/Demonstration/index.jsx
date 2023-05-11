import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { v4 as uuid } from 'uuid'
import Input from 'cozy-ui/react/Input'
import Label from 'cozy-ui/react/Label'
import { useClient, useQueryAll } from 'cozy-client'
import { nodesQuery, webhooksQuery } from 'lib/queries'
import createTree from 'lib/createTreeExported'
import TreeNetworkGraph from './TreeNetworkGraph'
import Spinner from 'cozy-ui/react/Spinner'
import { omit } from 'lodash'
import { Button } from 'cozy-ui/react/Button'

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
  const [tree, setTree] = useState()
  const [d3Tree, setD3Tree] = useState()
  const executionId = useMemo(() => uuid(), [])
  const treeStructure = useMemo(() => ({ depth, fanout, groupSize }), [
    depth,
    fanout,
    groupSize
  ])

  useEffect(() => {
    if (!tree || tree.length === 0) {
      setTree(nodes && nodes.length > 0 ? createTree(treeStructure, nodes) : [])
    }
  }, [nodes, tree, treeStructure])
  useEffect(() => {
    if (!tree && !d3Tree) return

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
        ...usedProperties(node),
        executionId
      }
    }
    tree.forEach(transformNode)

    setD3Tree(old => {
      if (!old) {
        old = {}
      }
      old.nodes = Object.values(nodesMap)
      old.edges = Object.entries(edgesMap).flatMap(([source, targets]) =>
        targets.map(target => ({ source, target }))
      )
      return old
    })
  }, [tree, executionId, d3Tree])

  const handleLaunchExecution = useCallback(async () => {
    for (const contributor of tree) {
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
  }, [tree, executionId, treeStructure, supervisorWebhook, client.stackClient])

  const handleTestObservation = useCallback(async () => {
    const node = d3Tree.nodes[0]
    const edge = d3Tree.edges[0]
    const emitter = d3Tree.nodes.find(e => e.nodeId === edge.source)
    const receiver = d3Tree.nodes.find(e => e.nodeId === edge.target)

    await client.stackClient.fetchJSON('POST', supervisorWebhook, {
      executionId: node.executionId,
      action: 'contribution',
      emitterDomain: emitter.label,
      emitterId: emitter.nodeId,
      receiverDomain: receiver.label,
      receiverId: receiver.nodeId,
      payload: {}
    })
  }, [client.stackClient, d3Tree, supervisorWebhook])

  return !nodes || isLoading ? (
    <Spinner size="xxlarge" middle />
  ) : (
    <div>
      {d3Tree ? (
        <TreeNetworkGraph data={d3Tree} width={400} height={400} />
      ) : null}
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
          //theme="danger"
          iconOnly
          label="Launch execution"
          onClick={handleLaunchExecution}
          extension="narrow"
        >
          Launch execution
        </Button>
        <Button
          className="button-basic"
          //theme="danger"
          iconOnly
          label="Launch execution"
          onClick={handleTestObservation}
          extension="narrow"
        >
          Test observation
        </Button>
      </div>
    </div>
  )
}

export default Demonstration
