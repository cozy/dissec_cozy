import React, { useCallback, useState } from 'react'
import { useClient } from 'cozy-client'

import Button from 'cozy-ui/react/Button'
import { BANK_DOCTYPE } from 'doctypes/bank'

export const OperationsDeleteAll = props => {
  const client = useClient()
  const { operations } = props
  const [isWorking, setIsWorking] = useState(false)

  const handleDelete = useCallback(async () => {
    setIsWorking(true)

    await client.collection(BANK_DOCTYPE).destroyAll(operations)

    setIsWorking(false)
  }, [client, operations, setIsWorking])

  if (!operations || !operations.length) return null

  return (
    <div>
      <h2>Delete all Operation:</h2>
      <Button
        onClick={handleDelete}
        busy={isWorking}
        theme="danger"
        label="delete all"
        size="large"
      />
    </div>
  )
}

export default OperationsDeleteAll
