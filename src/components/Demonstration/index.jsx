import React, { useMemo, useState } from 'react'
import Input from 'cozy-ui/react/Input'
import Label from 'cozy-ui/react/Label'
import { useQueryAll } from 'cozy-client'
import { nodesQuery } from 'lib/queries'
import createTree from 'lib/createTreeExported'
import TreeNetworkGraph from './TreeNetworkGraph'
import Spinner from 'cozy-ui/react/Spinner'
import { omit } from 'lodash'

const Demonstration = () => {
  const query = nodesQuery()
  const { data: nodes, isLoading } = useQueryAll(
    query.definition,
    query.options
  )
  const [nbShares, setNbShares] = useState(2)
  const [nbContributors, setNbContributors] = useState(2)
  const tree = useMemo(
    () =>
      nodes && nodes.length > 0
        ? createTree(
            [
              { numberOfNodes: 1 },
              { numberOfNodes: nbShares },
              { numberOfNodes: nbContributors }
            ],
            nodes,
            true
          )
        : [],
    [nbContributors, nbShares, nodes]
  )
  const d3TreeData = useMemo(() => {
    if (!tree) return

    const usedProperties = node => {
      return omit(node, ['parents'])
    }

    const nodesMap = {}
    const edgesList = []
    const transformNode = node => {
      if (!nodesMap[node.nodeId]) {
        nodesMap[node.nodeId] = { parents: [], children: [] }
      }

      for (const parent of node.parents || []) {
        nodesMap[node.nodeId].parents.push(parent.nodeId)
        edgesList.push({ source: node.nodeId, target: parent.nodeId })
        transformNode(parent)
        nodesMap[parent.nodeId] = {
          ...nodesMap[parent.nodeId],
          children: [...nodesMap[parent.nodeId].children, node.nodeId]
        }
      }
      nodesMap[node.nodeId] = {
        ...usedProperties(node),
        ...nodesMap[node.nodeId]
      }
    }
    tree.forEach(transformNode)

    return { nodes: Object.values(nodesMap), edges: edgesList }
  }, [tree])

  return !nodes || isLoading ? (
    <Spinner size="xxlarge" middle />
  ) : (
    <div>
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
      </div>
      {d3TreeData ? (
        <TreeNetworkGraph data={d3TreeData} width={400} height={400} />
      ) : null}
    </div>
  )
}

export default Demonstration
