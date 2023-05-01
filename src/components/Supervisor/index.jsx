import { useQuery } from 'cozy-client'
import Spinner from 'cozy-ui/react/Spinner'
import React, { useEffect, useState } from 'react'

import { observationsQuery } from 'lib/queries'
import Observation from './Observation'

export const Supervisor = () => {
  const query = observationsQuery()
  const { fetch, isFetching } = useQuery(query.definition, query.options)
  const [observations, setObservations] = useState()

  // FIXME: Using useEffect should not be necessary if useQuery correctly refreshed
  useEffect(() => {
    ;(async () => {
      const { data } = await fetch()
      setObservations(data)
    })()
  })

  return (
    <div>
      {isFetching ? (
        <Spinner size="xxlarge" middle />
      ) : observations ? (
        observations.map(observation => (
          <Observation key={observation.id} observation={observation} />
        ))
      ) : null}
    </div>
  )
}

export default Supervisor
