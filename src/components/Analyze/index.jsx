import React from 'react'

import { queryConnect } from 'cozy-client'
import { sharesQuery } from 'doctypes'

export const Analyze = () => {

  return (
    <div className="analyze">
    </div>
  )
}

// get data from the client state: data, fetchStatus
export default queryConnect({
  shares: {
    query: sharesQuery,
    as: 'shares'
  }
})(Analyze)
