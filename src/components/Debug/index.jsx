import React from 'react'

import { NavLink } from 'react-router-dom'
import Button from 'cozy-ui/transpiled/react/Buttons'
import Typography from 'cozy-ui/transpiled/react/Typography'

export const Debug = () => {
  return (
    <div className="u-p-half">
      <Typography variant="h3">Debug links</Typography>
      <div className="u-flex u-p-half u-flex-justify-around">
        <NavLink to="/nodes">
          <Button
            className="u-m-auto"
            style={{ display: 'flex' }}
            variant="ghost"
            label="Go to nodes"
          />
        </NavLink>
        <NavLink to="/supervisor">
          <Button
            className="u-m-auto"
            style={{ display: 'flex' }}
            variant="ghost"
            label="Go to supervisor"
          />
        </NavLink>
      </div>
    </div>
  )
}

export default Debug
