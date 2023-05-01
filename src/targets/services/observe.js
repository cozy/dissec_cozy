global.fetch = require('node-fetch').default

import CozyClient, { Q } from 'cozy-client'
import { OBSERVATIONS_DOCTYPE, JOBS_DOCTYPE } from 'doctypes'
import { createLogger } from './helpers'

export const observe = async () => {
  const client = CozyClient.fromEnv(process.env, {})

  const { log } = createLogger(client.stackClient.uri.split('/')[2])

  // Fetching parameters (if any) from the jobs
  const { data: job } = await client.query(
    Q(JOBS_DOCTYPE).getById(process.env['COZY_JOB_ID'].split('/')[2])
  )

  const { executionId, emitterDomain } = job.attributes.message

  log(`Received an observation from node ${emitterDomain}`)

  await client.create(OBSERVATIONS_DOCTYPE, job.attributes.message)
}

observe().catch(e => {
  // eslint-disable-next-line no-console
  console.log('critical', e)
  process.exit(1)
})
