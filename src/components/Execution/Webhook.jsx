import { useClient } from 'cozy-client'
import Button from 'cozy-ui/transpiled/react/Buttons'
import Switch from 'cozy-ui/transpiled/react/Switch'
import FormControlLabel from 'cozy-ui/transpiled/react/FormControlLabel'
import React, { useCallback, useState } from 'react'

import { JOBS_DOCTYPE } from 'doctypes'

export const Webhook = ({ hook, onUpdate }) => {
  const client = useClient()

  const [isWorking, setIsWorking] = useState(false)
  const [pretrained, setPretrained] = useState(true)

  let name = ''
  if (hook && hook.attributes) {
    if (hook.attributes.arguments.length !== 0) {
      name = hook.attributes.arguments
    } else if (hook.attributes?.message.name) {
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
    } else if (name === 'observe') {
      await client.stackClient.fetchJSON('POST', hook.links.webhook, {
        executionId: 'self-send',
        action: 'contribution',
        emitterDomain: 'test_emitter',
        emitterId: 'test_emitter',
        receiverDomain: 'test_receiver',
        receiverId: 'test_receiver',
        payload: { finished: true }
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
    <div className="u-flex u-flex-column u-card u-flex-items-center u-stack-xs u-m-half">
      <div className="info-category">
        <b>{name.toUpperCase() || '?'}</b>
      </div>
      <div className="webhook-url">{hook.links?.webhook || '???'}</div>
      {name === 'categorize' ? (
        <>
          <FormControlLabel
            label="Use pretrained model?"
            control={
              <Switch
                color="primary"
                checked={pretrained}
                onChange={handlePretrained}
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
      <div style={{ display: 'flex', gap: '1rem' }}>
        <Button
          variant="primary"
          color="error"
          label="Remove webhook"
          busy={isWorking}
          disabled={isWorking}
          onClick={handleRemoveWebhook}
        />
        <Button
          variant="primary"
          label="Call webhook"
          onClick={handleCallWebhook}
          busy={isWorking}
          disabled={isWorking}
        />
      </div>
    </div>
  )
}

// get data from the client state: data, fetchStatus
export default Webhook
