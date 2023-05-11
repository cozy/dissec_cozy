import { Q, fetchPolicies } from 'cozy-client'
import {
  TRIGGERS_DOCTYPE,
  BANK_OPERATIONS_DOCTYPE,
  NODES_DOCTYPE,
  OBSERVATIONS_DOCTYPE
} from '../doctypes'

const defaultFetchPolicy = fetchPolicies.olderThan(86_400_000) // 24 hours

export const webhooksQuery = () => ({
  definition: () => Q(TRIGGERS_DOCTYPE).where({ type: '@webhook' }),
  options: {
    as: `${TRIGGERS_DOCTYPE}/webhook`,
    fetchPolicy: defaultFetchPolicy
  }
})

export const bankOperationsQuery = () => ({
  definition: () => Q(BANK_OPERATIONS_DOCTYPE),
  options: {
    as: `${BANK_OPERATIONS_DOCTYPE}`
  }
})

export const nodesQuery = () => ({
  definition: () => Q(NODES_DOCTYPE),
  options: {
    as: `${NODES_DOCTYPE}`
  }
})

export const observationsQuery = () => ({
  definition: () => Q(OBSERVATIONS_DOCTYPE),
  options: {
    as: `${OBSERVATIONS_DOCTYPE}`
  }
})

export const recentObservationsQuery = executionId => ({
  definition: () =>
    Q(OBSERVATIONS_DOCTYPE)
      .indexFields(['updatedAt', 'executionId'])
      .where({
        executionId,
        action: {
          $ne: 'receiveShare'
        }
      })
      .sortBy([{ updatedAt: 'desc' }])
      .limitBy(3),
  options: {
    as: `${OBSERVATIONS_DOCTYPE}/${executionId}`
  }
})
