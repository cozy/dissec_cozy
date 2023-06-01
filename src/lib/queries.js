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

export const observationsByExecutionQuery = executionId => ({
  definition: () =>
    Q(OBSERVATIONS_DOCTYPE)
      .where({
        executionId: executionId
      })
      .indexFields(['executionId', 'cozyMetadata.updatedAt'])
      .sortBy([{ executionId: 'desc' }, { 'cozyMetadata.updatedAt': 'desc' }]),
  options: {
    as: `${OBSERVATIONS_DOCTYPE}/${executionId}`
  }
})

export const observationWebhookQuery = () => ({
  definition: () =>
    Q(TRIGGERS_DOCTYPE)
      .partialIndex({
        type: '@webhook',
        message: {
          name: 'observe'
        }
      })
      .limitBy(1),
  options: {
    as: `${TRIGGERS_DOCTYPE}/observe`,
    fetchPolicy: defaultFetchPolicy
  }
})

export const latestModelUpdateQuery = () => ({
  definition: () =>
    Q(OBSERVATIONS_DOCTYPE)
      .partialIndex({
        action: 'aggregation',
        payload: {
          finished: true
        }
      })
      .indexFields(['action', 'cozyMetadata.updatedAt'])
      .sortBy([{ action: 'desc' }, { 'cozyMetadata.updatedAt': 'desc' }])
      .limitBy(1),
  options: {
    as: `${OBSERVATIONS_DOCTYPE}/model`
  }
})

export const latestCategorizationQuery = () => ({
  definition: () =>
    Q(OBSERVATIONS_DOCTYPE)
      .partialIndex({
        action: 'categorize'
      })
      .indexFields(['action', 'cozyMetadata.updatedAt'])
      .sortBy([{ action: 'desc' }, { 'cozyMetadata.updatedAt': 'desc' }])
      .limitBy(1),
  options: {
    as: `${OBSERVATIONS_DOCTYPE}/categorize`
  }
})
