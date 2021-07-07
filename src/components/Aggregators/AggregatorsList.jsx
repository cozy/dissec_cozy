import React from 'react'

import Aggregator from './Aggregator'

export const AggregatorsList = props => {
  const { operations } = props

  if (!operations || !operations.length) return null
  return (
    <div>
      <h2>Operations list:</h2>
      {operations.map(operation => (
        <Aggregator key={operation._id} operation={operation} />
      ))}
    </div>
  )
}

export default AggregatorsList
