import { BANK_DOCTYPE } from './bank'
import { DISSEC_DOCTYPE } from './dissec'
import { MODELS_DOCTYPE } from './models'

// the documents schema, necessary for CozyClient
export default {
  bank: {
    doctype: BANK_DOCTYPE,
    attributes: {},
    relationships: {}
  },
  dissec: {
    doctype: DISSEC_DOCTYPE,
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
export * from './dissec'
export * from './models'
