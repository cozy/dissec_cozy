import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQueryAll } from 'cozy-client'
import { nodesQuery, observationsByExecutionQuery } from 'lib/queries'
import createTree from 'lib/createTreeExported'
import { omit } from 'lodash'

const useTree = ({ treeStructure }) => {
  const query = nodesQuery()
  const { data: nodes, isLoading } = useQueryAll(
    query.definition,
    query.options
  )
  const [tree, setLocalTree] = useState([])
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

  // Recompute tree
  useEffect(() => {
    if (!tree || tree[0]?.treeStructure !== treeStructure)
      setLocalTree(
        nodes && nodes.length > 0 ? createTree(treeStructure, nodes) : []
      )
  }, [nodes, setLocalTree, tree, treeStructure])

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
            treeIndex:
              nodesMap[e.target].treeIndex || nodesMap[e.source].treeIndex,
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

  const regenerateTree = useCallback(() => {
    setLocalTree(
      nodes && nodes.length > 0 ? createTree(treeStructure, nodes) : []
    )
  }, [nodes, treeStructure])

  return { treeNodes, treeEdges, tree, isLoading, regenerateTree }
}

export default useTree
