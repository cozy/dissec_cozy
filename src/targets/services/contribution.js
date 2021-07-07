global.fetch = require('node-fetch').default
global.btoa = require('btoa')

import CozyClient, { Q } from 'cozy-client'
import { BANK_DOCTYPE, DISSEC_DOCTYPE } from '../../doctypes'

import { Model } from './helpers'

export const contribution = async () => {
  const { sentences, parentsWebhook, security } =
    process.env['COZY_PAYLOAD'] || []

  // eslint-disable-next-line no-console
  console.log('contribution received', sentences, parentsWebhook, security)

  const client = CozyClient.fromEnv(process.env, {})

  // 1. Fetch training data
  const { data: operations } = await client.query(Q(BANK_DOCTYPE))

  // 2. Fetch model
  // We are using an empty intial model for now

  // 3. Update model parameters
  let model = Model.fromDocs(operations)

  // 4. Split model in shares
  let shares = model.getShares(security)

  // 5. Save shares in instance and create share links
  let links = []
  for (let i = 0; i < security; i++) {
    const document = await client.create(DISSEC_DOCTYPE, {
      ...shares[i],
      shareIndex: i
    })
    const body = {
      data: {
        type: 'io.cozy.sharings',
        attributes: {
          description: 'secret shares sharing',
          preview_path: '/preview-sharing',
          rules: [
            {
              title: 'Standard sharing',
              doctype: 'io.cozy.dissec.shares',
              values: [document._id],
              add: 'push',
              update: 'none',
              remove: 'revoke'
            }
          ]
        }
      }
    }
    const result = await client.stackClient.fetchJSON('POST', '/sharings', body)
    links.push(result.data.links.self)
  }

  // 6. Call webhooks of parents with the links
  links.forEach((link, i) =>
    fetch(parentsWebhook[i], {
      method: 'POST',
      body: { link: link, security: security, parentWebhook, finalize }
    })
  )
}

contribution().catch(e => {
  // eslint-disable-next-line no-console
  console.log('critical', e)
  process.exit(1)
})
