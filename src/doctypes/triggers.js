const { Q } = require('cozy-client')

const TRIGGERS_DOCTYPE = 'io.cozy.triggers'

// queries for CozyClient

const triggersQuery = Q(TRIGGERS_DOCTYPE)

module.exports = {
  TRIGGERS_DOCTYPE,
  triggersQuery
}
