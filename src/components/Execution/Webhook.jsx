import React, { useCallback, useState } from 'react'

import { TextField, Switch, FormControlLabel } from '@material-ui/core'
import Button from 'cozy-ui/react/Button'

import { useClient } from 'cozy-client'

export const Webhook = ({ hook, onUpdate }) => {
  const client = useClient()

  const [isWorking, setIsWorking] = useState(false)
  const [input, setInput] = useState('')
  const [pretrained, setPretrained] = useState(true)

  let name = ''
  if (hook && hook.attributes) {
    if (hook.attributes.arguments.length !== 0) {
      name = hook.attributes.arguments
    } else if (hook.attributes.message) {
      name = hook.attributes.message.name
    }
  }

  const handleCallWebhook = useCallback(
    async () => {
      setIsWorking(true)

      let body
      if (name === 'categorize') {
        body = {
          pretrained
        }
      }

      try {
        await client.stackClient.fetchJSON('POST', hook.links.webhook, body)
      } finally {
        setIsWorking(false)
      }
    },
    [hook, name, pretrained, setIsWorking, client.stackClient]
  )

  const handleRemoveWebhook = useCallback(
    async () => {
      setIsWorking(true)
      await client.stackClient.fetchJSON('DELETE', hook.links.self)
      setIsWorking(false)
      onUpdate && onUpdate()
    },
    [hook, client, onUpdate, setIsWorking]
  )

  const handlePretrained = useCallback(
    () => {
      setPretrained(!pretrained)
    },
    [pretrained, setPretrained]
  )

  const handleLabelChange = useCallback(
    async e => {
      setInput(e.target.value)
    },
    [setInput]
  )

  return (
    <div className="webhook">
      <div className="info-category">
        <b>{name.toUpperCase() || '?'}</b>
      </div>
      <div className="webhook-url">{hook.links.webhook}</div>
      {name === 'categorize' ? (
        <>
          <FormControlLabel
            label="Use pretrained model?"
            control={
              <Switch
                checked={pretrained}
                onChange={handlePretrained}
                name="Use pretrained model?"
              />
            }
          />
        </>
      ) : name === 'aggregation' ? (
        <></>
      ) : (
        <>
          <TextField
            className="label"
            label="Operation label"
            variant="outlined"
            value={input}
            onChange={handleLabelChange}
          />
        </>
      )}
      <form>
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
            onClick={handleCallWebhook}
            //theme="danger"
            iconOnly
            label="Call webhook"
            busy={isWorking}
            disabled={isWorking}
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
