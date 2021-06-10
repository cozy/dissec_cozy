import React, { Component } from 'react'

import Button from 'cozy-ui/react/Button'
import { withClient } from 'cozy-client'

export class FindWebhooks extends Component {
  constructor(props) {
    super(props)
    // initial component state
    this.state = { isWorking: false }

    console.log('okokko', props)
  }

  // delete the related todo
  findHooks = async () => {
    const { deleteDocument, todo } = this.props
    console.log(this.props)
    // display a spinner during the process
    // this.setState(() => ({ isWorking: true }))
    // delete the todo in the Cozy : asynchronous
    // await deleteDocument(todo)
    // remove the spinner
    // this.setState(() => ({ isWorking: false }))
    // We can omit that since this component will be
    // unmount after the document is deleted by the client
  }

  render() {
    const { isWorking } = this.state
    return (
      <Button
        className="todo-remove-button"
        theme="danger"
        icon="delete"
        iconOnly
        label="Delete"
        busy={isWorking}
        disabled={isWorking}
        onClick={this.findHooks}
        extension="narrow"
      />
    )
  }
}

// get mutations from the client to use deleteDocument
export default withClient(FindWebhooks)
