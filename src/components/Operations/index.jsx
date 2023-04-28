import React from 'react'

import Spinner from 'cozy-ui/react/Spinner'
import { useQuery } from 'cozy-client'
import { bankQuery } from '../../lib/queries'
import OperationAdd from './OperationAdd'
import OperationsList from './OperationsList'
import OperationDeleteAll from './OperationsDeleteAll'
import { useState } from 'react'
import { useEffect } from 'react'

export const Operations = () => {
  const query = bankQuery()
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
