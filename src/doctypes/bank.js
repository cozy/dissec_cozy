const { Q } = require('cozy-client')

const BANK_DOCTYPE = 'io.cozy.bank.operations'

// queries for CozyClient

const bankQuery = Q(BANK_DOCTYPE)

module.exports = {
  BANK_DOCTYPE,
  bankQuery
}
