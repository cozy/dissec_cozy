import React, { useCallback, useState } from 'react'
import { useClient } from 'cozy-client'
import Button from 'cozy-ui/react/Button'

export const Share = ({ share }) => {
  const client = useClient()

  const [isWorking, setIsWorking] = useState(false)

  const handleRemoveData = useCallback(
    async () => {
      setIsWorking(true)
      await client.destroy(share)
      setIsWorking(false)
    },
    [share, client, setIsWorking]
  )

  return (
    <div className="webhook">
      <ul>
        {share &&
          Object.keys(share).map((key, i) => (
            <li key={i}>
              <span className="info-category">
                <b>{key} </b>
              </span>
              <span className="info-value">{JSON.stringify(share[key])}</span>
            </li>
          ))}
      </ul>
      <Button
        className="todo-remove-button"
        theme="danger"
        iconOnly
        label="Remove data"
        busy={isWorking}
        disabled={isWorking}
        onClick={handleRemoveData}
        extension="narrow"
      >
        Remove this data
      </Button>
    </div>
  )
}

export default Share
