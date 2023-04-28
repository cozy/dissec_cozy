import React from 'react'

import Spinner from 'cozy-ui/react/Spinner'
import { useQuery } from 'cozy-client'
import { nodesQuery } from 'lib/queries'

import NodeAdd from './NodeAdd'
import NodesList from './NodesList'
import NodeUpload from './NodeUpload'
import { useState } from 'react'
import { useEffect } from 'react'

export const Nodes = () => {
  const query = nodesQuery()
  const { isLoading, fetch } = useQuery(query.definition, query.options)
  const [nodes, setNodes] = useState()

  // FIXME: Using useEffect should not be necessary if useQuery correctly refreshed
  useEffect(() => {
    ;(async () => {
      if (!nodes) {
        const { data } = await fetch()
        setNodes(data)
      }
    })()
  })

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
