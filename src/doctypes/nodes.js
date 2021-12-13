const { Q } = require('cozy-client')

const NODES_DOCTYPE = 'io.cozy.dissec.nodes'

// queries for CozyClient

const nodesQuery = Q(NODES_DOCTYPE)

module.exports = {
  NODES_DOCTYPE,
  nodesQuery
}
