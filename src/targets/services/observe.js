global.fetch = require('node-fetch').default

import CozyClient from 'cozy-client'
import { OBSERVATIONS_DOCTYPE } from 'doctypes'
import { createLogger } from './helpers'

export const observe = async () => {
  const client = CozyClient.fromEnv(process.env, {})

  const { log } = createLogger(client.stackClient.uri.split('/')[2])

  log(`Received an observation from node`)

  await client.create(
    OBSERVATIONS_DOCTYPE,
    JSON.parse(process.env['COZY_PAYLOAD'] || '{}')
  )
}

observe().catch(e => {
  // eslint-disable-next-line no-console
  console.log('critical', e)
  process.exit(1)
})
