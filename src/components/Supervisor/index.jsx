import { useClient, useQueryAll } from 'cozy-client'
import Spinner from 'cozy-ui/react/Spinner'
import React, { useCallback, useEffect, useMemo, useState } from 'react'

import { observationsQuery } from 'lib/queries'
import { ExecutionGroup } from './ExecutionGroup'
import { Button } from 'cozy-ui/react/Button'
import { OBSERVATIONS_DOCTYPE } from 'doctypes'

export const Supervisor = () => {
  const client = useClient()
  const query = observationsQuery()
  const { fetch, isFetching } = useQueryAll(query.definition, query.options)
  const [observations, setObservations] = useState()
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

  // FIXME: Using useEffect should not be necessary if useQuery correctly refreshed
  useEffect(() => {
    const fetchObservations = async () => {
      const { data } = await fetch()
      setObservations(data)
    }
    if (!observations) {
      fetchObservations()
    }

    const interval = setInterval(fetchObservations, 10000)
    return () => clearInterval(interval)
  }, [fetch, observations])

  const handleDelete = useCallback(async () => {
    setIsWorking(true)

    await client.collection(OBSERVATIONS_DOCTYPE).destroyAll(observations)
    const { data } = await fetch()
    setObservations(data)

    setIsWorking(false)
  }, [client, fetch, observations])

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
          <h1 style={{ textAlign: 'center' }}>There are no observations yet</h1>
        )
      ) : null}
    </div>
  )
}

export default Supervisor
