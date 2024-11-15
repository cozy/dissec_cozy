import React, { useCallback, useState } from 'react'
import { useClient } from 'cozy-client'

import Button from 'cozy-ui/transpiled/react/Buttons'
import { BANK_OPERATIONS_DOCTYPE } from 'doctypes'

export const OperationsDeleteAll = props => {
  const client = useClient()
  const { operations } = props
  const [isWorking, setIsWorking] = useState(false)

  const handleDelete = useCallback(async () => {
    setIsWorking(true)

    await client.collection(BANK_OPERATIONS_DOCTYPE).destroyAll(operations)

    setIsWorking(false)
  }, [client, operations, setIsWorking])

  if (!operations || !operations.length) return null

  return (
    <div>
      <h2>Delete all Operation:</h2>
      <Button
        variant="primary"
        color="error"
        label="delete all"
        onClick={handleDelete}
        busy={isWorking}
      />
    </div>
  )
}

export default OperationsDeleteAll
