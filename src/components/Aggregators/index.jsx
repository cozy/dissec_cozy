import React from 'react'

import Spinner from 'cozy-ui/react/Spinner'
import { queryConnect } from 'cozy-client'
import { aggregatorsQuery } from 'doctypes'

import AggregatorAdd from './AggregatorAdd'
import AggregatorsList from './AggregatorsList'

export const Aggregators = ({ aggregators }) => {
  const { isLoading, data } = aggregators

  console.log('aggregators', data, isLoading)

  return (
    <div className="todos">
      {isLoading ? (
        <Spinner size="xxlarge" middle />
      ) : (
        <div>
          <AggregatorsList operations={data} />
          <AggregatorAdd />
        </div>
      )}
    </div>
  )
}

// get data from the client state: data, fetchStatus
export default queryConnect({
  aggregators: {
    query: aggregatorsQuery,
    as: 'aggregators'
  }
})(Aggregators)
