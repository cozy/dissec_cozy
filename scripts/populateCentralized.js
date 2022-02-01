/// TODO: Merge this script with `populate` once the centralized population is more flexible

const { execSync } = require('child_process')

const { splitClasses } = require('./splitClasses')
const { updateWebhook } = require('./webhooks')
const { loadWebhooks } = require('./loadWebhooks')

/**
 * This script only work with 10 instances.
 * It creates a set of 9 distinct categories set.
 * The first instance receives all the data while other 9 instances only get one set per instance.
 */
export const populateCentralized = async (
  operationsPerInstance = 10,
  fixtureFile = './assets/fixtures-l.json'
) => {
  const nInstances = 10

  console.log('Clearing old webhooks...')
  try {
    execSync('rm ./assets/webhooks.json')
  } catch {}

  const classesDissec = splitClasses(9, 10)

  for (let i = 0; i < nInstances; i++) {
    const domain = `test${i + 1}.localhost:8080`

    console.log('Destroying instance', domain)
    execSync(`cozy-stack instances destroy ${domain} --force`)

    execSync(
      `cozy-stack instances add --apps drive,photos ${domain} --passphrase cozy`
    )
    execSync(`cozy-stack instances modify ${domain} --onboarding-finished`)

    if (i === 0) {
      console.log(`Importing all the data in instance ${domain}`)
      const ACHToken = execSync(
        `cozy-stack instances token-cli ${domain} io.cozy.bank.operations`
      )
      for (let j = 0; j < 9; j++) {
        execSync(
          `ACH -u http://${domain} -y script banking/importFilteredOperations ${fixtureFile} ${
            classesDissec[j]
          } ${operationsPerInstance} -x -t ${ACHToken}`
        )
      }
    } else {
      console.log(
        `Importing data of classes ${
          classesDissec[i - 1]
        } in instance ${domain}`
      )
      const ACHToken = execSync(
        `cozy-stack instances token-cli ${domain} io.cozy.bank.operations`
      )
      execSync(
        `ACH -u http://${domain} -y script banking/importFilteredOperations ${fixtureFile} ${
          classesDissec[i - 1]
        } ${operationsPerInstance} -x -t ${ACHToken}`
      )
    }

    const token = execSync(`cozy-stack instances token-app ${domain} dissecozy`)

    execSync(
      `cozy-stack apps install --domain ${domain} dissecozy file://${process.cwd()}/build/`
    )

    console.log('Saving webhooks...')
    await updateWebhook(
      `http://${domain}`,
      token.toString().replace('\n', ''),
      './assets/webhooks.json'
    )
  }

  console.log('Updating the querier with fresh webhooks...')
  const token = execSync(
    `cozy-stack instances token-app cozy.localhost:8080 dissecozy`
  )
  await loadWebhooks(
    'http://cozy.localhost:8080',
    token.toString().replace('\n', ''),
    './assets/webhooks.json'
  )
}

// populateCentralized(process.argv[2], process.argv[3])
