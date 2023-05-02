import { useQueryAll } from 'cozy-client'
import Spinner from 'cozy-ui/react/Spinner'
import React, { useEffect, useMemo, useState } from 'react'

import { observationsQuery } from 'lib/queries'
import { ExecutionGroup } from './ExecutionGroup'

export const Supervisor = () => {
  const query = observationsQuery()
  const { fetch, isFetching } = useQueryAll(query.definition, query.options)
  const [observations, setObservations] = useState()
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

  return (
    <div>
      {isFetching ? (
        <Spinner size="xxlarge" middle />
      ) : observations ? (
        <>
          <h3>Executions list</h3>
          <div className="execution-group-container">
            {Object.keys(executions).map(group => (
              <ExecutionGroup
                key={group}
                title={group}
                group={executions[group]}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}

export default Supervisor
