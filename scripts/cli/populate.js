const { program } = require('commander')
const populateInstances = require('../populateInstances')

program
  .option('--centralized')
  .option(
    '-n, --n-instances <n>',
    "Number of instances spawned. Can't be used yet.",
    Number,
    10
  )
  .option('-c, --classes <n>', 'Number of classes per instance', Number, 10)
  .option(
    '-o, --operations <n>',
    'Number of bank operations per instance',
    Number,
    30
  )
  .option(
    '-f, --fixture <path>',
    'Fixture file for bank operations',
    './assets/fixtures-l.json'
  )
  .option(
    '-w, --webhooks <path>',
    'File where the webhooks of created instances will be stored',
    './assets/webhooks.json'
  )
  .option(
    '-s, --supervisor <domain>',
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