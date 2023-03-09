/// TODO: Merge this script with `populateCentralized` once the centralized population is more flexible

const util = require('node:util');
const exec = util.promisify(require('node:child_process').exec);
const fs = require('fs')
const splitClasses = require('../src/lib/splitClasses')
const { loadWebhooks } = require('./loadWebhooks')
const { createLogger } = require('../src/targets/services/helpers/utils')
const { default: CozyClient, Q } = require('cozy-client')

const populateInstances = async (
  nInstances = 10,
  nClasses = 10,
  operationsPerInstance = 30,
  fixtureFile = './assets/fixtures-l.json'
) => {
  const { log } = createLogger()

  log('Clearing old webhooks...')
  try {
    await exec('rm ./assets/webhooks.json')
    log('Cleared!')
  } catch(err) {
    log('No webhooks to clear')
  }

  const classes = splitClasses(nInstances, nClasses)

  const populateSingleInstance = async (domain, classes) => {
    log('Destroying instance', domain)
    try {
      await exec(`cozy-stack instances destroy ${domain} --force`)
    } catch (err) {
      log('Instance does not exist')
    }

    await exec(
      `cozy-stack instances add --apps drive,photos ${domain} --passphrase cozy`
    )
    await exec(`cozy-stack instances modify ${domain} --onboarding-finished`)

    log(`Importing operations of the following classes for instance ${domain}: ${classes}`)
    const { stdout: ACHToken} = await exec(
      `cozy-stack instances token-cli ${domain} io.cozy.bank.operations`
    )
    await exec(
      `ACH -u http://${domain} -y script banking/importFilteredOperations ${fixtureFile} ${classes} ${operationsPerInstance} ${domain} -x -t ${ACHToken}`
    )

    await exec(
      `cozy-stack apps install --domain ${domain} dissecozy file://${process.cwd()}/build/`
    )
  }

  const domains = Array(nInstances).fill("").map((_, i) => `test${i + 1}.localhost:8080`)

  // Populate instances
  await Promise.all(domains.map((e, i) => populateSingleInstance(e, classes[i])))

  // Collect webhooks
  const webhooks = await Promise.all(domains.map(async (domain) => {
    const uri = `http://${domain}`

    // Get a token
    const {stdout} = await exec(`cozy-stack instances token-app ${domain} dissecozy`)
    const token = stdout.toString().replace('\n', '')

    // Connect to the instance
    const client = new CozyClient({
      uri: uri,
      schema: {
        triggers: {
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

    return entry
  }))

  // Write fetched webhooks to the disk
  const webhooksPath = './assets/webhooks.json'
  fs.writeFileSync(webhooksPath, JSON.stringify(webhooks, null, 2))

  // Upload webhooks on the coordinating instance
  log('Updating the querier with fresh webhooks...')
  const {stdout: token} = await exec(
    `cozy-stack instances token-app cozy.localhost:8080 dissecozy`
  )
  await loadWebhooks(
    'http://cozy.localhost:8080',
    token.toString().replace('\n', ''),
    webhooksPath
  )
}

populateInstances(
  process.argv[2],
  process.argv[3],
  process.argv[4],
  process.argv[5]
)
