import { useClient, useQueryAll } from 'cozy-client'
import Spinner from 'cozy-ui/react/Spinner'
import React, { useCallback, useMemo, useState } from 'react'

import { observationsQuery } from 'lib/queries'
import { ExecutionGroup } from './ExecutionGroup'
import { Button } from 'cozy-ui/react/Button'
import { OBSERVATIONS_DOCTYPE } from 'doctypes'

export const Supervisor = () => {
  const client = useClient()
  const query = observationsQuery()
  const { data: observations, isFetching } = useQueryAll(
    query.definition,
    query.options
  )
  const [isWorking, setIsWorking] = useState(false)
  const executions = useMemo(() => {
    const res = {}

    if (!observations) {
      return res
    }

    for (const o of observations) {
      const executionId = o.executionId || 'Unknown'

      if (!res[executionId]) {
        res[executionId] = []
      }

      res[executionId].push(o)
    }

    return res
  }, [observations])

  const handleDelete = useCallback(async () => {
    setIsWorking(true)

    await client.collection(OBSERVATIONS_DOCTYPE).destroyAll(observations)

    setIsWorking(false)
  }, [client, observations])

  return (
    <div>
      {isFetching ? (
        <Spinner size="xxlarge" middle />
      ) : observations ? (
        observations.length > 0 ? (
          <>
            <h2>Executions list</h2>
            <div className="execution-group-container">
              {Object.keys(executions).map(group => (
                <ExecutionGroup
                  key={group}
                  title={group}
                  group={executions[group]}
                />
              ))}
            </div>
            <h2>Delete all Operation:</h2>
            <Button
              onClick={handleDelete}
              busy={!observations || isWorking}
              theme="danger"
              label={`Delete ${observations.length || '??'} observations`}
              size="large"
            />
          </>
        ) : (
          <h1 style={{ textAlign: 'center' }}>There is no observation yet</h1>
        )
      ) : null}
    </div>
  )
}

export default Supervisor
