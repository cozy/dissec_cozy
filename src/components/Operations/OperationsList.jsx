import React from 'react'

import Operation from './Operation'

export const OperationsList = props => {
  const { operations } = props
  if (!operations || !operations.length) return null
  return (
    <div>
      <h2>Operations list:</h2>
      {operations.map(operation => (
        <Operation key={operation._id} operation={operation} />
      ))}
    </div>
  )
}

export default OperationsList
