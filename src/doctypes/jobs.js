const { Q } = require('cozy-client')

const JOBS_DOCTYPE = 'io.cozy.jobs'

// queries for CozyClient

const jobsQuery = Q(JOBS_DOCTYPE)

module.exports = {
  JOBS_DOCTYPE,
  jobsQuery
}
