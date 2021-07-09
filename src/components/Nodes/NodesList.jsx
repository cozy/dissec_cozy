import React from 'react'

import Node from './Node'

export const NodesList = props => {
  const { operations } = props

  if (!operations || !operations.length) return null
  return (
    <div>
      <h2>Operations list:</h2>
      {operations.map(operation => (
        <Node key={operation._id} operation={operation} />
      ))}
    </div>
  )
}

export default NodesList
