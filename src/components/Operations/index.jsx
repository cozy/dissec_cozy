import React from 'react'

import Spinner from 'cozy-ui/react/Spinner'
import { useQueryAll } from 'cozy-client'
import { bankOperationsQuery } from 'lib/queries'
import OperationAdd from './OperationAdd'
import OperationsList from './OperationsList'
import OperationDeleteAll from './OperationsDeleteAll'

export const Operations = () => {
  const query = bankOperationsQuery()
  const { isLoading, data: operations } = useQueryAll(
    query.definition,
    query.options
  )

  return (
    <div className="todos">
      {isLoading ? (
        <Spinner size="xxlarge" middle />
      ) : (
        <div>
          <OperationsList operations={operations} />
          <OperationAdd />
          <OperationDeleteAll operations={operations} />
        </div>
      )}
    </div>
  )
}

// get data from the client state: data, fetchStatus
export default Operations
