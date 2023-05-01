import React from 'react'

export const Observation = ({ observation }) => {
  const { id, name } = observation

  return (
    <div className="webhook">
      <div className="info-category">
        <b>{id}</b>
      </div>
      <div className="webhook-url">{name}</div>
    </div>
  )
}

// get data from the client state: data, fetchStatus
export default Observation
