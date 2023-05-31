import React, { useCallback, useState } from 'react'

import Spinner from 'cozy-ui/react/Spinner'
import { useQuery } from 'cozy-client'
import { bankOperationsQuery } from 'lib/queries'
import OperationAdd from './OperationAdd'
import OperationsList from './OperationsList'
import OperationDeleteAll from './OperationsDeleteAll'
import ClassifyOperations from './ClassifyOperations'
import ClassificationStatistics from './ClassificationStatistics'
import { Button } from 'cozy-ui/react/Button'

export const Operations = () => {
  const query = bankOperationsQuery()
  const { isLoading, data: operations, fetchMore } = useQuery(
    query.definition,
    query.options
  )
  const [isWorking, setIsWorking] = useState(false)

  const handleFetchMore = useCallback(async () => {
    setIsWorking(true)
    await fetchMore()
    setIsWorking(false)
  }, [fetchMore])

  return (
    <div className="todos">
      {isLoading ? (
        <Spinner size="xxlarge" middle />
      ) : (
        <div>
          <ClassifyOperations />
          <ClassificationStatistics />
          <Button
            onClick={handleFetchMore}
            busy={isWorking}
            label="fetch more"
            size="large"
            extension="full"
          />
          <OperationAdd />
          <OperationDeleteAll operations={operations} />
          <OperationsList operations={operations} />
        </div>
      )}
    </div>
  )
}

export default Operations
