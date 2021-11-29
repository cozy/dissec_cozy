global.fetch = require('node-fetch').default
const fs = require('fs')
const { default: CozyClient, Q } = require('cozy-client')

const { NODES_DOCTYPE } = require('../src/doctypes/nodes')
const newWebhooks = require('../assets/webhooks.json')

const main = async () => {
  // Connect to the instance
  const client = new CozyClient({
    uri: process.argv[2],
    schema: {
      nodes: {
        doctype: NODES_DOCTYPE,
        attributes: {},
        relationships: {}
      }
    },
    token: process.argv[3]
  })

  // Fetch old nodes
  const { data: oldNodes } = await client.queryAll(Q(NODES_DOCTYPE))

  // Delete them
  await client.collection(NODES_DOCTYPE).destroyAll(oldNodes)

  // Create a new doc for each instance
  await client.collection(NODES_DOCTYPE).saveAll(newWebhooks)
}

main()