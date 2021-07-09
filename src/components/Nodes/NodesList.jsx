import React from 'react'

import Node from './Node'

export const NodesList = props => {
  const { nodes } = props

  if (!nodes || !nodes.length) return null
  return (
    <div>
      <h2>Nodes list:</h2>
      {nodes.map(node => (
        <Node key={node._id} node={node} />
      ))}
    </div>
  )
}

export default NodesList
