import React from 'react'

import Spinner from 'cozy-ui/react/Spinner'
import { useQueryAll } from 'cozy-client'
import { nodesQuery } from 'lib/queries'

import NodeAdd from './NodeAdd'
import NodesList from './NodesList'
import NodeUpload from './NodeUpload'

export const Nodes = () => {
  const query = nodesQuery()
  const { data: nodes, isLoading } = useQueryAll(
    query.definition,
    query.options
  )

  return !nodes || isLoading ? (
    <Spinner size="xxlarge" middle />
  ) : (
    <div>
      <NodesList nodes={nodes} />
      <NodeUpload />
      <NodeAdd />
    </div>
  )
}

// get data from the client state: data, fetchStatus
export default Nodes
