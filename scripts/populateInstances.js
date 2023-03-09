/// TODO: Merge this script with `populateCentralized` once the centralized population is more flexible

const { execSync } = require('child_process')

const splitClasses = require('../src/lib/splitClasses')
const { updateWebhook } = require('./webhooks')
const { loadWebhooks } = require('./loadWebhooks')
const { createLogger } = require('../src/targets/services/helpers/utils')

const populateInstances = async (
  nInstances = 10,
  nClasses = 10,
  operationsPerInstance = 30,
  fixtureFile = './assets/fixtures-l.json'
) => {
  const { log } = createLogger()

  log('Clearing old webhooks...')
  try {
    execSync('rm ./assets/webhooks.json')
  } finally {
    log('Cleared!')
  }

  const classes = splitClasses(nInstances, nClasses)

  for (let i = 0; i < nInstances; i++) {
    const domain = `test${i + 1}.localhost:8080`

    log('Destroying instance', domain)
    try {
      execSync(`cozy-stack instances destroy ${domain} --force`)
    } catch (err) {
      log('Instance does not exist')
    }

    execSync(
      `cozy-stack instances add --apps drive,photos ${domain} --passphrase cozy`
    )
    execSync(`cozy-stack instances modify ${domain} --onboarding-finished`)

    log(`Importing operations of the following classes: ${classes[i]}`)
    const ACHToken = execSync(
      `cozy-stack instances token-cli ${domain} io.cozy.bank.operations`
    )
    execSync(
      `ACH -u http://${domain} -y script banking/importFilteredOperations ${fixtureFile} ${classes[i]} ${operationsPerInstance} ${domain} -x -t ${ACHToken}`
    )

    const token = execSync(`cozy-stack instances token-app ${domain} dissecozy`)

    execSync(
      `cozy-stack apps install --domain ${domain} dissecozy file://${process.cwd()}/build/`
    )

    log('Saving webhooks...')
    await updateWebhook(
      `http://${domain}`,
      token.toString().replace('\n', ''),
      './assets/webhooks.json'
    )
  }

  log('Updating the querier with fresh webhooks...')
  const token = execSync(
    `cozy-stack instances token-app cozy.localhost:8080 dissecozy`
  )
  await loadWebhooks(
    'http://cozy.localhost:8080',
    token.toString().replace('\n', ''),
    './assets/webhooks.json'
  )
}

populateInstances(
  process.argv[2],
  process.argv[3],
  process.argv[4],
  process.argv[5]
)
