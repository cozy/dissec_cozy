import { BANK_DOCTYPE } from './bank'
import { DISSEC_DOCTYPE } from './dissec'

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
  }
}

// export all doctypes for the application
export * from './bank'
export * from './dissec'
