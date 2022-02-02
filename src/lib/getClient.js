const { default: CozyClient, createClientInteractive } = require('cozy-client')

/**
 * Returns a CozyClient for the provided URI.
 * If a token is not given in the options, create an interactive one using OAuth.
 *
 * @param {string} uri - The URI of the instance
 * @param {Object} schema - The schema to access data
 * @param {Object} options - Options such as the token
 * @returns The CozyClient
 */
const getClient = async (uri, schema, options = {}) => {
  const { token } = options
  if (token) {
    return new CozyClient({
      uri,
      schema,
      token: token
    })
  } else {
    return await createClientInteractive({
      scope: Object.values(schema).map(e => e.doctype),
      uri,
      schema,
      oauth: {
        softwareID: 'io.cozy.client.cli'
      }
    })
  }
}

module.exports = getClient
