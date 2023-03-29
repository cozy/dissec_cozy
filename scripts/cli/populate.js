const { program } = require('commander')
const populateInstances = require('../populateInstances')

program
  .option('--centralized')
  .option(
    '-n, --n-instances',
    "Number of instances spawned. Can't be used yet.",
    10
  )
  .option('-c, --classes', 'Number of classes per instance', 10)
  .option('-o, --operations', 'Number of bank operations per instance', 30)
  .option(
    '-f, --fixture',
    'Fixture file for bank operations',
    './assets/fixtures-l.json'
  )
  .option(
    '-w, --webhooks',
    'File where the webhooks of created instances will be stored',
    './assets/webhooks.json'
  )
  .option(
    '-s, --supervisor',
    'Domain of the instance supervising the protocol',
    'cozy.localhost:8080'
  )

program.parse()

const options = program.opts()

populateInstances({
  nInstances: options.nInstances,
  nClasses: options.classes,
  operationsPerInstance: options.operations,
  fixtureFile: options.fixture,
  centralized: options.centralized
})
