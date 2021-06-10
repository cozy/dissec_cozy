import React from 'react'

//import Spinner from 'cozy-ui/react/Spinner'
import { queryConnect } from 'cozy-client'
import { todosQuery, sharesQuery } from 'doctypes'
import { FindWebhooks } from './FindWebhooks'

export const Analyze = ({ todos }) => {
  const { data, fetchStatus } = todos
  // cozy-client statuses
  const isLoading = fetchStatus === 'loading' || fetchStatus === 'pending'
  return (
    <div className="todos">
      <FindWebhooks />
    </div>
  )
}

// get data from the client state: data, fetchStatus
export default queryConnect({
  todos: {
    query: todosQuery,
    as: 'todos'
  },
  shares: {
    query: sharesQuery,
    as: 'shares'
  }
})(Analyze)
