import React, { useCallback, useState } from 'react'

import Input from 'cozy-ui/react/Input'
import Label from 'cozy-ui/react/Label'
import Button from 'cozy-ui/react/Button'

import { useClient } from 'cozy-client'

export const Webhook = ({ hook }) => {
  const client = useClient()

  const [isWorking, setIsWorking] = useState(false)
  const [input, setInput] = useState('')

  const handleCallWebhook = useCallback(
    async () => {
      setIsWorking(true)
      await client.stackClient.fetchJSON('POST', `/jobs/webhooks/${hook.id}`, {
        inputs: [input]
      })
      setInput('')
      setIsWorking(false)
    },
    [hook, input, setInput, setIsWorking]
  )

  const handleRemoveWebhook = useCallback(
    async () => {
      setIsWorking(true)
      await client.stackClient.fetchJSON('DELETE', `/jobs/triggers/${hook.id}`)
      setIsWorking(false)
    },
    [hook]
  )

  const handleLabelChange = useCallback(
    async (e) => {
      setInput(e.target.value)
    },
    [setInput]
  )

  return (
    <div className="webhook">
      <ul>
        <li>
          <span className="info-category">
            <b>Identifier </b>
          </span>
          <span className="info-value">{hook.attributes.message.name}</span>
        </li>
        <li>
          <span className="info-category">
            <b>Created at </b>
          </span>
          <span className="info-value">
            {new Date(hook.attributes.cozyMetadata.createdAt).toLocaleString()}
          </span>
        </li>
      </ul>
      <form onSubmit={handleCallWebhook}>
        <Label htmlFor="todo-add-input"> Operation label: </Label>
        <Input
          value={input}
          onChange={handleLabelChange}
          id="todo-add-input"
        />
        <div className="action-group">
          <Button
            className="todo-remove-button"
            theme="danger"
            iconOnly
            label="Remove webhook"
            busy={isWorking}
            disabled={isWorking}
            onClick={handleRemoveWebhook}
            extension="narrow"
          >
            Remove this webhook
          </Button>
          <Button
            className="todo-remove-button"
            //theme="danger"
            iconOnly
            label="Call webhook"
            busy={isWorking}
            disabled={isWorking}
            type="submit"
            extension="narrow"
          >
            Call this webhook
          </Button>
        </div>
      </form>
    </div>
  )
}

// get data from the client state: data, fetchStatus
export default Webhook
