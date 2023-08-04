import React, { useCallback, useState } from 'react'

import Spinner from 'cozy-ui/react/Spinner'
import { useQuery } from 'cozy-client'
import { bankOperationsQuery } from 'lib/queries'
import OperationAdd from './OperationAdd'
import OperationsList from './OperationsList'
import OperationDeleteAll from './OperationsDeleteAll'
import Button from 'cozy-ui/transpiled/react/Buttons'
import PlusSmallIcon from 'cozy-ui/transpiled/react/Icons/PlusSmall'
import Icon from 'cozy-ui/transpiled/react/Icon'

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
    <div className="u-p-half u-mb-3">
      {isLoading ? (
        <Spinner size="xxlarge" middle />
      ) : (
        <div>
          <OperationsList operations={operations} />
          <Button
            className="u-m-auto"
            style={{ display: 'flex' }}
            variant="ghost"
            label={
              <>
                <Icon icon={PlusSmallIcon} className="u-ph-half" />
                <span>fetch more</span>
              </>
            }
            onClick={handleFetchMore}
            busy={isWorking}
          />
          <OperationAdd />
          <OperationDeleteAll operations={operations} />
        </div>
      )}
    </div>
  )
}

export default Operations
