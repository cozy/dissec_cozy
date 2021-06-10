//global.fetch = require('node-fetch')
global.btoa = require('btoa')

require('@tensorflow/tfjs')
const toxicity = require('@tensorflow-models/toxicity')

export const test = async () => {
  // The minimum prediction confidence.
  const threshold = 0.9

  // Load the model. Users optionally pass in a threshold and an array of
  // labels to include.
  toxicity.load(threshold).then(model => {
    const sentences = [
      'you suck',
      'julien is the greatest ever',
      'you are the worst ever, bitch',
      'i will cut your throat sexually'
    ]

    model.classify(sentences).then(predictions => {
      // `predictions` is an array of objects, one for each prediction head,
      // that contains the raw probabilities for each input along with the
      // final prediction in `match` (either `true` or `false`).
      // If neither prediction exceeds the threshold, `match` is `null`.

      // eslint-disable-next-line no-console
      predictions.forEach(prediction => console.log(prediction))
    })
  })
}

test().catch(e => {
  // eslint-disable-next-line no-console
  console.log('critical', e)
  process.exit(1)
})
