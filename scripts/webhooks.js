global.fetch = require('node-fetch').default
const fs = require('fs')
const { default: CozyClient } = require('cozy-client')

const main = async () => {
  // Connect to the instance
  const client = new CozyClient({
    uri: process.argv[2],
    schema: {
      nodes: {
        doctype: 'io.cozy.triggers',
        attributes: {},
        relationships: {}
      }
    },
    token: process.argv[3]
  })

  // Fetch triggers
  const { data } = await client.queryAll(Q('io.cozy.triggers'))

  // Filter for webhooks
  let webhooks = data
    .filter(hook => hook.attributes.type === '@webhook')

  // Save DISSEC webhooks
  let entry = { label: process.argv[2] }
  for (let webhook of webhooks) {
    if (webhook.attributes.message.name === "contribution") {
      entry.contributionWebhook = webhook.links.webhook
    } else if (webhook.attributes.message.name === "receiveShares") {
      entry.aggregationWebhook = webhook.links.webhook
    }
  }

  // Read the result
  let result
  try {
    result = JSON.parse(fs.readFileSync(process.argv[4]))
  } catch (err) {
    result = []
  }

  // Insert the new entry
  result.push(entry)

  // Write the new result
  fs.writeFileSync(
    process.argv[4],
    JSON.stringify(result, null, 2)
  )
}

main()