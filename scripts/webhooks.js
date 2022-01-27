global.fetch = require('node-fetch').default
const fs = require('fs')
const { default: CozyClient, Q } = require('cozy-client')

const updateWebhook = async (uri, token, outputFile) => {
  // Connect to the instance
  const client = new CozyClient({
    uri: uri,
    schema: {
      nodes: {
        doctype: 'io.cozy.triggers',
        attributes: {},
        relationships: {}
      }
    },
    token: token
  })

  // Fetch triggers
  const data = await client.queryAll(Q('io.cozy.triggers'))

  // Filter for webhooks
  let webhooks = data.filter(hook => hook.attributes.type === '@webhook')

  // Save DISSEC webhooks
  let entry = { label: uri }
  for (let webhook of webhooks) {
    if (webhook.attributes.message.name === 'contribution') {
      entry.contributionWebhook = webhook.links.webhook
    } else if (webhook.attributes.message.name === 'receiveShares') {
      entry.aggregationWebhook = webhook.links.webhook
    }
  }

  // Read the result
  let result
  try {
    result = JSON.parse(fs.readFileSync(outputFile))
  } catch (err) {
    result = []
  }

  // Insert the new entry
  result.push(entry)

  // Write the new result
  fs.writeFileSync(outputFile, JSON.stringify(result, null, 2))
}

module.exports = {
  updateWebhook
}
