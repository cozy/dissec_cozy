global.fetch = require('node-fetch').default
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
  const oldNodes = await client.queryAll(Q(NODES_DOCTYPE))

  // Delete them
  await client.collection(NODES_DOCTYPE).destroyAll(oldNodes)

  // Create a new doc for each instance
  // Using collection to force the doctype
  await client.collection(NODES_DOCTYPE).updateAll(newWebhooks)
}

main()