import React from 'react'

import Node from './Node'

export const NodesList = props => {
  const { nodes } = props

  if (!nodes || !nodes.length) return null
  return (
    <div>
      <h2>Nodes list</h2>
      <span>
        All the nodes this instance can monitor are listed below. Run populating
        scripts to register nodes.
      </span>
      <div className="nodes-list">
        {nodes.map(node => (
          <Node key={node._id} node={node} />
        ))}
      </div>
    </div>
  )
}

export default NodesList
