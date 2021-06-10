import React from 'react'

import Spinner from 'cozy-ui/react/Spinner'
import { queryConnect } from 'cozy-client'
import { todosQuery } from 'doctypes'

import TodoAdd from './TodoAdd'
import TodosList from './TodosList'

export const Todos = ({ todos }) => {
  const { isLoading, data } = todos

  return (
    <div className="todos">
      {isLoading ? (
        <Spinner size="xxlarge" middle />
      ) : (
        <div>
          <TodosList todos={data} />
          <TodoAdd />
        </div>
      )}
    </div>
  )
}

// get data from the client state: data, fetchStatus
export default queryConnect({
  todos: {
    query: todosQuery,
    as: 'todos'
  }
})(Todos)
