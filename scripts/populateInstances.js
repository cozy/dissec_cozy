/// TODO: Merge this script with `populateCentralized` once the centralized population is more flexible

const util = require('util')
const exec = util.promisify(require('child_process').exec)
const fs = require('fs')
const splitClasses = require('../src/lib/splitClasses')
const { loadWebhooks } = require('./loadWebhooks')
const { createLogger } = require('../src/targets/services/helpers/utils')
const { default: CozyClient, Q } = require('cozy-client')

const populateInstances = async ({
  nInstances = 10,
  nClasses = 10,
  operationsPerInstance = 30,
  fixtureFile = './assets/fixtures-l.json',
  centralized = false,
  outputWebhooksPath = './generated/webhooks.json',
  supervisingInstanceDomain = 'cozy.localhost:8080',
  instancePrefix = 'test'
}) => {
  const { log } = createLogger()

  log('Clearing old webhooks...')
  try {
    await exec(`rm ${outputWebhooksPath}`)
    log('Cleared!')
  } catch (err) {
    log('No webhooks to clear')
  }

  const fixtures = JSON.parse(fs.readFileSync(fixtureFile).toString())
  const allClasses = [
    ...new Set(fixtures['io.cozy.bank.operations'].map(e => e.manualCategoryId))
  ]
  const classes = splitClasses(
    centralized ? nInstances - 1 : nInstances,
    nClasses,
    allClasses
  )

  const populateSingleInstance = async (
    domain,
    classes,
    operations = operationsPerInstance
  ) => {
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

    log(
      `Importing ${operations} operations of the following classes for instance ${domain}: ${classes}`
    )
    const { stdout: ACHToken } = await exec(
      `cozy-stack instances token-cli ${domain} io.cozy.bank.operations`
    )
    await exec(
      `yarn run ACH -u http://${domain} -y script banking/importFilteredOperations ${fixtureFile} ${classes} ${operations} ${domain} -x -t ${ACHToken}`
    )

    await exec(
      `cozy-stack apps install --domain ${domain} dissecozy file://${process.cwd()}/build/`
    )
  }

  const domains = Array(nInstances)
    .fill('')
    .map((_, i) => `${instancePrefix}${i + 1}.localhost:8080`)

  // Populate instances
  await Promise.all(
    domains.map(async (e, i) => {
      if (centralized) {
        if (i === 0) {
          await populateSingleInstance(e, classes.flat())
        } else {
          await populateSingleInstance(e, classes[i - 1])
        }
      } else {
        await populateSingleInstance(e, classes[i])
      }
    })
  )

  // Collect webhooks
  const webhooks = await Promise.all(
    domains.map(async domain => {
      const uri = `http://${domain}`

      // Get a token
      const { stdout } = await exec(
        `cozy-stack instances token-app ${domain} dissecozy`
      )
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

      // NOTE: Fetching all triggers returns, document links like webhooks.
      // We need those links to avoid reconstructing it from the document
      // we could have fetched when adding a where clause.
      // See https://github.com/cozy/cozy-client/blob/master/packages/cozy-stack-client/src/TriggerCollection.js#L119

      // Fetch triggers
      const triggers = await client.queryAll(Q('io.cozy.triggers'))
      // Filter for webhooks
      let webhooks = triggers.filter(
        trigger => trigger.attributes.type === '@webhook'
      )

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
    })
  )

  // Write fetched webhooks to the disk
  fs.writeFileSync(outputWebhooksPath, JSON.stringify(webhooks, null, 2))

  // Create the supervisor instance
  log('Destroying instance', supervisingInstanceDomain)
  try {
    await exec(
      `cozy-stack instances destroy ${supervisingInstanceDomain} --force`
    )
  } catch (err) {
    log('Instance does not exist')
  }
  await exec(
    `cozy-stack instances add --apps drive,photos ${supervisingInstanceDomain} --passphrase cozy`
  )
  await exec(
    `cozy-stack instances modify ${supervisingInstanceDomain} --onboarding-finished`
  )
  await exec(
    `cozy-stack apps install --domain ${supervisingInstanceDomain} dissecozy file://${process.cwd()}/build/`
  )

  // Upload webhooks on the supervisor instance
  log('Updating the supervisor with fresh webhooks...')
  const { stdout: token } = await exec(
    `cozy-stack instances token-app ${supervisingInstanceDomain} dissecozy`
  )
  await loadWebhooks(
    `http://${supervisingInstanceDomain}`,
    token.toString().replace('\n', ''),
    outputWebhooksPath
  )
}

module.exports = populateInstances
