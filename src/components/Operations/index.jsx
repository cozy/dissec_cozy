import React from 'react'

import Spinner from 'cozy-ui/react/Spinner'
import { queryConnect } from 'cozy-client'
import { bankQuery } from 'doctypes'

import OperationAdd from './OperationAdd'
import OperationsList from './OperationsList'
import OperationDeleteAll from './OperationsDeleteAll'

export const Operations = ({ bank }) => {
  const { isLoading, data } = bank

  return (
    <div className="todos">
      {isLoading ? (
        <Spinner size="xxlarge" middle />
      ) : (
        <div>
          <OperationsList operations={data} />
          <OperationAdd />
          <OperationDeleteAll operations={data} />
        </div>
      )}
    </div>
  )
}

// get data from the client state: data, fetchStatus
export default queryConnect({
  bank: {
    query: bankQuery,
    as: 'bank'
  }
})(Operations)
