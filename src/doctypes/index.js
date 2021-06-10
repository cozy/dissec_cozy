import { TODOS_DOCTYPE } from './todos'
import { DISSEC_DOCTYPE } from './dissec'

// the documents schema, necessary for CozyClient
export default {
  todos: {
    doctype: TODOS_DOCTYPE,
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
export * from './todos'
export * from './dissec'
