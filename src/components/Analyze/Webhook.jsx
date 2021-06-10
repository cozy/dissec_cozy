import React, { useCallback, useEffect, useState } from 'react'

import Button from 'cozy-ui/react/Button'
import { queryConnect, useClient, TriggerCollection } from 'cozy-client'
import { sharesQuery, DISSEC_DOCTYPE } from 'doctypes'

export const Webhook = ({ hook, callWebhook }) => {
  const [isWorking, setIsWorking] = useState(false)

  const handleCallWebhook = useCallback(
    async () => {
      setIsWorking(true)
      await callWebhook(hook, ['you suck'])
      setIsWorking(false)
    },
    [hook, callWebhook]
  )

  return (
    <div className="webhook">
      <ul>
        <li>
          <span className="info-category"><b>Identifier </b></span>
          <span className="info-value">{hook.attributes.arguments}</span>
        </li>
        <li>
          <span className="info-category"><b>Created at </b></span>
          <span className="info-value">{new Date(hook.attributes.cozyMetadata.createdAt).toLocaleString()}</span>
        </li>
      </ul>
      <Button
        className="todo-remove-button"
        //theme="danger"
        iconOnly
        label="Call webhook"
        busy={isWorking}
        disabled={isWorking}
        onClick={handleCallWebhook}
        extension="narrow"
      >
        Call this webhook
      </Button>
    </div>
  )
}

// get data from the client state: data, fetchStatus
export default Webhook
