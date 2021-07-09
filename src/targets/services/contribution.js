global.fetch = require('node-fetch').default
global.btoa = require('btoa')

import fs from 'fs'
import CozyClient, { Q } from 'cozy-client'
import { BANK_DOCTYPE, DISSEC_DOCTYPE } from '../../doctypes'

import { Model } from './helpers'

export const contribution = async () => {
  const { parents, nbShares, pretrained } =
    process.env['COZY_PAYLOAD'] || []

  // eslint-disable-next-line no-console
  console.log('contribution received', parents, nbShares, pretrained)

  if (parents.length !== nbShares) {
    console.log("invalid parents array or number of shares")
    return
  }

  const client = CozyClient.fromEnv(process.env, {})

  // 1. Fetch training data
  const { data: operations } = await client.query(Q(BANK_DOCTYPE))

  // 2. Fetch model
  let model
  if (pretrained) {
    let backup = fs.readFileSync('/mnt/c/Users/Projets/Cozy/categorization-model/model.json')
    model = Model.fromBackup(backup)

    // 3. Train locally
    model.train(operations)
  } else {
    model = Model.fromDocs(operations)
  }

  // 4. Split model in shares
  let shares = model.getShares(nbShares)

  // 5. Save shares in instance and create share links
  let links = []
  for (let i = 0; i < nbShares; i++) {
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
    fetch(parents[i].webhook, {
      method: 'POST',
      body: { share: link, nbShares, parents: parents[i].parents, finalize: parents[i].finalize }
    })
  )
}

contribution().catch(e => {
  // eslint-disable-next-line no-console
  console.log('critical', e)
  process.exit(1)
})
