export const BANK_DOCTYPE = 'io.cozy.bank.operations'
export const JOBS_DOCTYPE = 'io.cozy.jobs'
export const MODELS_DOCTYPE = 'io.cozy.dissec.models'
export const NODES_DOCTYPE = 'io.cozy.dissec.nodes'
export const OBSERVATIONS_DOCTYPE = 'io.cozy.dissec.observations'
export const SHARES_DOCTYPE = 'io.cozy.dissec.shares'
export const TRIGGERS_DOCTYPE = 'io.cozy.triggers'

// the documents schema, necessary for CozyClient
export default {
  bank: {
    doctype: BANK_DOCTYPE,
    attributes: {},
    relationships: {}
  },
  nodes: {
    doctype: NODES_DOCTYPE,
    attributes: {},
    relationships: {}
  },
  shares: {
    doctype: SHARES_DOCTYPE,
    attributes: {},
    relationships: {}
  },
  models: {
    doctype: MODELS_DOCTYPE,
    attributes: {},
    relationships: {}
  }
}
