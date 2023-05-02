global.fetch = require('node-fetch').default
const fs = require('fs')
const { default: CozyClient, Q } = require('cozy-client')

const { NODES_DOCTYPE } = require('../src/doctypes')

const loadWebhooks = async (uri, token, outputFile) => {
  // Connect to the instance
  const client = new CozyClient({
    uri: uri,
    schema: {
      nodes: {
        doctype: NODES_DOCTYPE,
        attributes: {},
        relationships: {}
      }
    },
    token: token
  })

  // Fetch old nodes
  const oldNodes = await client.queryAll(Q(NODES_DOCTYPE))

  // Delete them
  await client.collection(NODES_DOCTYPE).destroyAll(oldNodes)

  // Create a new doc for each instance
  // Using collection to force the doctype
  const newWebhooks = JSON.parse(fs.readFileSync(outputFile).toString())
  await client.collection(NODES_DOCTYPE).updateAll(newWebhooks)
}

module.exports = {
  loadWebhooks
}
