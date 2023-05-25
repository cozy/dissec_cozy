import React, { useCallback, useState } from 'react'
import { useClient, useQuery } from 'cozy-client'
import Button from 'cozy-ui/react/Button'
import { latestModelUpdateQuery } from 'lib/queries'
import { JOBS_DOCTYPE } from 'doctypes'

export const ClassifyOperations = () => {
  const client = useClient()
  const [isWorking, setIsWorking] = useState(false)
  const modelQuery = latestModelUpdateQuery()
  const { data } = useQuery(modelQuery.definition, modelQuery.options)
  const [lastModel] = data || []

  const handleClassify = useCallback(async () => {
    setIsWorking(true)

    await client.collection(JOBS_DOCTYPE).create('service', {
      slug: 'dissecozy',
      name: 'categorize',
      pretrained: true
    })

    setIsWorking(false)
  }, [client])

  return (
    <div>
      <span>
        Latest model trained at {lastModel?.cozyMetadata?.updatedAt || '???'}
      </span>
      <Button
        onClick={handleClassify}
        busy={isWorking}
        label="Launch classification"
        size="large"
        extension="full"
      />
    </div>
  )
}

export default ClassifyOperations
