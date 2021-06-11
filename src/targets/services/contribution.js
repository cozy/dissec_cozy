//global.fetch = require('node-fetch')
global.btoa = require('btoa')

const { addData } = require('cozy-konnector-libs')

require('@tensorflow/tfjs')
const toxicity = require('@tensorflow-models/toxicity')

export const test = async () => {
  // Worker's arguments
  const sentences = process.env['COZY_PAYLOAD'] || []

  // The minimum prediction confidence.
  const threshold = 0.9

  // Load the model. Users optionally pass in a threshold and an array of
  // labels to include.
  const model = await toxicity.load(threshold)
  const predictions = await model.classify(sentences)
  // `predictions` is an array of objects, one for each prediction head,
  // that contains the raw probabilities for each input along with the
  // final prediction in `match` (either `true` or `false`).
  // If neither prediction exceeds the threshold, `match` is `null`.

  // eslint-disable-next-line no-console
  predictions.forEach(prediction => console.log(prediction))

  await addData(predictions, 'io.cozy.dissec.shares')
}

test().catch(e => {
  // eslint-disable-next-line no-console
  console.log('critical', e)
  process.exit(1)
})
