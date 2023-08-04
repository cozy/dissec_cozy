import React, { useCallback, useMemo, useState } from 'react'
import Input from 'cozy-ui/react/Input'
import Label from 'cozy-ui/react/Label'
import Spinner from 'cozy-ui/react/Spinner'
import Button from 'cozy-ui/transpiled/react/Buttons'
import Paper from 'cozy-ui/transpiled/react/Paper'
import useTree from '../hooks/useTree'

const TreeCreator = ({ busy, setTreeNodes, setTreeEdges }) => {
  const [depth, setDepth] = useState(3)
  const [fanout, setFanout] = useState(3)
  const [groupSize, setGroupSize] = useState(2)
  const treeStructure = useMemo(() => ({ depth, fanout, groupSize }), [
    depth,
    fanout,
    groupSize
  ])
  const { tree, treeEdges, treeNodes, isLoading, regenerateTree } = useTree({
    treeStructure
  })

  const handleCreate = useCallback(() => {
    setTreeNodes(treeNodes)
    setTreeEdges(treeEdges)
    // Immediatly regenerate the tree so that the next creation is the regenerated tree
    regenerateTree()
  }, [regenerateTree, setTreeEdges, setTreeNodes, treeEdges, treeNodes])

  return !tree || isLoading ? (
    <Spinner size="xxlarge" middle />
  ) : (
    <Paper
      className="u-bg-silver"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        margin: '1rem',
        padding: '1rem'
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-around',
          gap: '1rem'
        }}
      >
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
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <Button
          variant="primary"
          label="Create tree"
          onClick={handleCreate}
          disabled={busy}
        />
      </div>
    </Paper>
  )
}

export default TreeCreator
