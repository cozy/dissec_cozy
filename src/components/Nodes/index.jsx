import React from 'react'

import Spinner from 'cozy-ui/react/Spinner'
import { useQuery } from 'cozy-client'
import { nodesQuery } from 'lib/queries'

import NodeAdd from './NodeAdd'
import NodesList from './NodesList'
import NodeUpload from './NodeUpload'

export const Nodes = () => {
  const query = nodesQuery()
  const { data: nodes, isLoading } = useQuery(query.definition, query.options)

  return (
    <div className="todos">
      {!nodes || isLoading ? (
        <Spinner size="xxlarge" middle />
      ) : (
        <div>
          <NodesList nodes={nodes} />
          <NodeUpload />
          <NodeAdd />
        </div>
      )}
    </div>
  )
}

// get data from the client state: data, fetchStatus
export default Nodes
