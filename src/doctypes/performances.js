const { Q } = require('cozy-client')

const PERFORMANCES_DOCTYPE = 'io.cozy.dissec.performances'

// queries for CozyClient

const performancesQuery = Q(PERFORMANCES_DOCTYPE)

module.exports = {
    PERFORMANCES_DOCTYPE,
    performancesQuery
}
