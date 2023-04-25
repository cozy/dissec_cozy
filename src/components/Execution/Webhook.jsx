import { FormControlLabel, Switch } from '@material-ui/core'
import { useClient } from 'cozy-client'
import Button from 'cozy-ui/react/Button'
import React, { useCallback, useState } from 'react'

import { JOBS_DOCTYPE } from '../../doctypes/jobs'

export const Webhook = ({ hook, onUpdate }) => {
  const client = useClient()

  const [isWorking, setIsWorking] = useState(false)
  const [pretrained, setPretrained] = useState(true)

  let name = ''
  if (hook && hook.attributes) {
    if (hook.attributes.arguments.length !== 0) {
      name = hook.attributes.arguments
    } else if (hook.attributes.message) {
      name = hook.attributes.message.name
    }
  }

  const handleCallWebhook = useCallback(async () => {
    setIsWorking(true)

    let body
    if (name === 'categorize') {
      await client.collection(JOBS_DOCTYPE).create('service', {
        slug: 'dissecozy',
        name: 'categorize',
        pretrained: pretrained
      })
    } else {
      try {
        await client.stackClient.fetchJSON('POST', hook.links.webhook, body)
      } catch (err) {
        console.error(err)
      }
    }

    setIsWorking(false)
  }, [client, hook, name, pretrained, setIsWorking])

  const handleRemoveWebhook = useCallback(async () => {
    setIsWorking(true)
    await client.destroy(hook)
    setIsWorking(false)
    onUpdate && onUpdate()
  }, [hook, client, onUpdate, setIsWorking])

  const handlePretrained = useCallback(() => {
    setPretrained(!pretrained)
  }, [pretrained, setPretrained])

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
      ) : (
        <b>
          This webhook should not be called from the UI and is only here for
          debugging purpose.
        </b>
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
