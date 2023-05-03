import React, { useState, useEffect } from 'react'

import Spinner from 'cozy-ui/react/Spinner'
import { useQuery } from 'cozy-client'
import { bankOperationsQuery } from 'lib/queries'
import OperationAdd from './OperationAdd'
import OperationsList from './OperationsList'
import OperationDeleteAll from './OperationsDeleteAll'

export const Operations = () => {
  const query = bankOperationsQuery()
  const { isLoading, fetch } = useQuery(query.definition, query.options)
  const [banks, setBanks] = useState()

  // FIXME: Using useEffect should not be necessary if useQuery correctly refreshed
  useEffect(() => {
    ;(async () => {
      if (!banks) {
        const { data } = await fetch()
        setBanks(data)
      }
    })()
  })

  return (
    <div className="todos">
      {isLoading ? (
        <Spinner size="xxlarge" middle />
      ) : (
        <div>
          <OperationsList operations={banks} />
          <OperationAdd />
          <OperationDeleteAll operations={banks} />
        </div>
      )}
    </div>
  )
}

// get data from the client state: data, fetchStatus
export default Operations
