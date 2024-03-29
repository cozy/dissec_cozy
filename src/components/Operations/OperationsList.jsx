import React from 'react'

import Operation from './Operation'
import Typography from 'cozy-ui/transpiled/react/Typography'

export const OperationsList = ({ operations }) => {
  if (!operations || !operations.length) return null
  return (
    <div>
      <Typography variant="h2">Operations list</Typography>
      <span>
        This section details all the banking operations the instance has. You
        can click on individual operation to see more details and use the
        dropdown element to manually define the category of the operation. You
        can also delete individual operation when looking at the details.
        Categories displayed in the dropdown are used a ground truth to train
        the model.
      </span>
      <div className="u-p-half">
        {operations.map(operation => (
          <Operation key={operation._id} operation={operation} />
        ))}
      </div>
    </div>
  )
}

export default OperationsList
