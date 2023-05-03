import React from 'react'

export const Observation = ({ observation }) => {
  const displayedKeys = ['action', 'emitterDomain', 'receiverDomain']

  return (
    <>
      <div className="observation">
        <ul>
          {displayedKeys.map(key => (
            <li key={key}>
              {key}: {observation[key] || '???'}
            </li>
          ))}
        </ul>
      </div>
    </>
  )
}

// get data from the client state: data, fetchStatus
export default Observation
