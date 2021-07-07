import { BANK_DOCTYPE } from './bank'
import { AGGREGATORS_DOCTYPE } from './aggregators'
import { SHARES_DOCTYPE } from './shares'
import { MODELS_DOCTYPE } from './models'

// the documents schema, necessary for CozyClient
export default {
  bank: {
    doctype: BANK_DOCTYPE,
    attributes: {},
    relationships: {}
  },
  aggregators: {
    doctype: AGGREGATORS_DOCTYPE,
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

// export all doctypes for the application
export * from './bank'
export * from './aggregators'
export * from './shares'
export * from './models'
