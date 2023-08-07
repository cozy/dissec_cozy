import React, { useEffect, useState } from 'react'
import Input from 'cozy-ui/react/Input'
import Label from 'cozy-ui/react/Label'
import Paper from 'cozy-ui/transpiled/react/Paper'

const TreeCreator = ({ setTreeStructure }) => {
  const [depth, setDepth] = useState(3)
  const [fanout, setFanout] = useState(3)
  const [groupSize, setGroupSize] = useState(2)

  useEffect(() => {
    setTreeStructure({ depth, fanout, groupSize })
  }, [depth, fanout, groupSize, setTreeStructure])

  return (
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
    </Paper>
  )
}

export default TreeCreator
