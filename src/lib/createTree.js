const { v4: uuid } = require('uuid')

/**
 * This function is used to create the aggregation tree
 *
 * @param {Webhooks} querierWebhooks The webhooks of the querier
 * @param {Webhooks[]} aggregatorsWebhooks The list of webhooks used by aggregators
 * @param {Webhooks[]} contributorsWebhooks The list of webhooks used by contributors
 * @returns
 */
const createTree = (querierWebhooks, aggregatorsWebhooks, contributorsWebhooks) => {
  // TODO: Make a dynamic tree
  const querier = {
    webhook: querierWebhooks.aggregationWebhook,
    level: 0,
    nbChild: 3,
    aggregatorId: uuid(),
    finalize: true
  }

  const aggregators = [
    {
      webhook: aggregatorsWebhooks[0].aggregationWebhook,
      level: 1,
      nbChild: contributorsWebhooks.length,
      parent: querier,
      aggregatorId: uuid(),
      finalize: false
    },
    {
      webhook: aggregatorsWebhooks[1].aggregationWebhook,
      level: 1,
      nbChild: contributorsWebhooks.length,
      parent: querier,
      aggregatorId: uuid(),
      finalize: false
    },
    {
      webhook: aggregatorsWebhooks[2].aggregationWebhook,
      level: 1,
      nbChild: contributorsWebhooks.length,
      parent: querier,
      aggregatorId: uuid(),
      finalize: false
    }
  ]

  let contributors = contributorsWebhooks.map(e => ({
    ...e,
    level: 2,
    nbChild: 0,
    parents: aggregators
  }))

  return contributors
}

module.exports = createTree
