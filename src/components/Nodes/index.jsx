import React from 'react'

import Spinner from 'cozy-ui/react/Spinner'
import { queryConnect } from 'cozy-client'
import { nodesQuery } from 'doctypes'

import NodeAdd from './NodeAdd'
import NodesList from './NodesList'

export const Nodes = ({ nodes }) => {
  const { isLoading, data } = nodes

  return (
    <div className="todos">
      {isLoading ? (
        <Spinner size="xxlarge" middle />
      ) : (
        <div>
          <NodesList nodes={data} />
          <NodeAdd />
        </div>
      )}
    </div>
  )
}

// get data from the client state: data, fetchStatus
export default queryConnect({
  nodes: {
    query: nodesQuery,
    as: 'nodes'
  }
})(Nodes)
