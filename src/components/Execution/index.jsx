import React, { Component } from 'react'

import Spinner from 'cozy-ui/react/Spinner'
import { queryConnect } from 'cozy-client'
import { todosQuery } from 'doctypes'

import TodoAdd from './TodoAdd'
import TodosList from './TodosList'

export class Todos extends Component {
  constructor(props) {
    super(props)

    this.state = {
      isLoading: false,
      data: props.todos.data
    }
    console.log("todos", props)
  }

  componentDidUpdate() {
    console.log("todos update", this.props)
  }

  render() {
    return (
    <div className="todos">
      {this.isLoading ? (
        <Spinner size="xxlarge" middle />
      ) : (
        <div>
          <TodosList todos={this.data} />
          <TodoAdd />
        </div>
      )}
    </div>
    )
  }
}

// get data from the client state: data, fetchStatus
export default queryConnect({
  todos: {
    query: todosQuery,
    as: 'todos'
  }
})(Todos)
