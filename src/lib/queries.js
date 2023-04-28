import { Q, fetchPolicies } from 'cozy-client'
import {
  TRIGGERS_DOCTYPE,
  PERFORMANCES_DOCTYPE,
  SHARES_DOCTYPE,
  BANK_DOCTYPE,
  NODES_DOCTYPE,
  MODELS_DOCTYPE
} from '../doctypes'
import { JOBS_DOCTYPE } from '../doctypes/jobs'

const defaultFetchPolicy = fetchPolicies.olderThan(86_400_000) // 24 hours

export const webhooksQuery = () => ({
  definition: () => Q(TRIGGERS_DOCTYPE).where({ type: '@webhook' }),
  options: {
    as: `${TRIGGERS_DOCTYPE}`,
    fetchPolicy: defaultFetchPolicy
  }
})

export const bankQuery = () => ({
  definition: () => Q(BANK_DOCTYPE),
  options: {
    as: `${BANK_DOCTYPE}`
  }
})

export const jobsQuery = () => ({
  definition: Q(JOBS_DOCTYPE),
  options: {
    as: `${JOBS_DOCTYPE}/type`
  }
})

export const nodesQuery = () => ({
  definition: () => Q(NODES_DOCTYPE),
  options: {
    as: `${NODES_DOCTYPE}`
  }
})

export const modelsQuery = () => ({
  definition: Q(MODELS_DOCTYPE),
  options: {
    as: `${MODELS_DOCTYPE}/type`
  }
})

export const performancesQuery = () => ({
  definition: Q(PERFORMANCES_DOCTYPE),
  options: {
    as: `${PERFORMANCES_DOCTYPE}/type`
  }
})

export const sharesQuery = () => ({
  definition: Q(SHARES_DOCTYPE),
  options: {
    as: `${SHARES_DOCTYPE}/type`
  }
})
