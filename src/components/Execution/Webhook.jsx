import React, { useCallback, useState } from 'react'

import { TextField, Switch, FormControlLabel } from '@material-ui/core'
import Input from 'cozy-ui/react/Input'
import Label from 'cozy-ui/react/Label'
import Button from 'cozy-ui/react/Button'

import { useClient } from 'cozy-client'

export const Webhook = ({ hook }) => {
  const client = useClient()

  const [isWorking, setIsWorking] = useState(false)
  const [input, setInput] = useState('')
  const [pretrained, setPretrained] = useState(true)

  const handleCallWebhook = useCallback(
    async () => {
      setIsWorking(true)

      let body
      if (hook.attributes.message.name === 'categorize') {
        body = {
          pretrained
        }
      }

      await client.stackClient.fetchJSON(
        'POST',
        `/jobs/webhooks/${hook.id}`,
        body
      )
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
    [hook, client, setIsWorking]
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
        <b>{hook.attributes.message.name.toUpperCase()}</b>
      </div>
      {hook.attributes.message.name === 'categorize' ? (
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
      ) : hook.attributes.message.name === 'aggregation' ? (
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
