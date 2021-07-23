import vocabulary from './vocabulary.json'
import classes from './classes.json'

const NOISE_CEILING = 1000000000000

export class Model {
  constructor() {
    this.uniqueY = Object.keys(classes)
    this.priors = Array(classes.length).fill(1)
    this.occurences = Array(vocabulary.length)
      .fill()
      .map(() =>
        Array(this.uniqueY.length)
          .fill()
          .map(() => 1)
      )
    this.logProbabilities = Array(vocabulary.length)
      .fill()
      .map(() =>
        Array(this.uniqueY.length)
          .fill()
          .map(() => 0)
      )
    this.contributions = 1
  }

  static fromBackup(doc) {
    let model = new Model()
    model.occurences = doc.occurences
    model.contributions = doc.contributions
    model.initialize()
    return model
  }

  static fromShares(shares, finalize) {
    let model = new Model()
    model.contributions = 0
    shares.forEach(share => (model.contributions += share.contributions))

    for (let j = 0; j < vocabulary.length; j++) {
      for (let i = 0; i < model.uniqueY.length; i++) {
        let acc = 0
        for (let k = 0; k < shares.length; k++) {
          acc += shares[k].occurences[j][i]
        }
        model.occurences[j][i] = acc
      }
    }

    if (finalize) {
      for (let j = 0; j < vocabulary.length; j++) {
        for (let i = 0; i < model.uniqueY.length; i++) {
          model.occurences[j][i] /= model.contributions
        }
      }

      model.initialize()
    }

    return model
  }

  static fromDocs(docs) {
    let model = new Model()

    model.train(docs)

    return model
  }

  initialize() {
    for (const j in vocabulary) {
      const total = this.occurences[j].reduce((a, b) => a + b)
      for (const i in this.uniqueY) {
        this.logProbabilities[j][i] = Math.log(this.occurences[j][i] / total)
      }
    }
  }

  train(docs) {
    for (let doc of docs) {
      // Only learn from categorized docs
      if (doc.cozyCategoryId) {
        const classId = this.uniqueY.indexOf(doc.cozyCategoryId)
        const tokens = doc.label.split(' ')

        for (const token of tokens) {
          const index = vocabulary.indexOf(token)
          if (index >= 0) {
            this.occurences[index][classId] += 1
            this.priors[classId] += 1
          }
        }
      }
    }

    this.initialize()
  }

  predict(text) {
    let probability = Array(this.uniqueY.length).fill(0)
    const tokens = text.split(' ')

    for (const token of tokens) {
      const index = vocabulary.indexOf(token)
      if (index >= 0) {
        for (const i in this.uniqueY) {
          probability[i] += this.logProbabilities[index][i]
        }
      }
    }

    const best = Math.max(...probability)
    const result = probability.indexOf(best) // this defaults to 0 -> uncategorized

    return this.uniqueY[result]
  }

  getShares(nbShares) {
    // Initialize shares array
    let shares = Array(nbShares)
      .fill()
      .map(() => ({
        occurences: this.occurences.map(e => e.map(f => f)),
        contributions: this.contributions
      }))

    for (let j = 0; j < vocabulary.length; j++) {
      for (let i = 0; i < this.uniqueY.length; i++) {
        // Generate noises
        let finalNoise = 0
        for (let k = 0; k < nbShares; k++) {
          const noise = Math.ceil(Math.random() * (NOISE_CEILING / nbShares))
          shares[k].occurences[j][i] += k === nbShares - 1 ? -finalNoise : noise
          finalNoise += noise
        }
      }
    }

    return shares
  }

  getBackup() {
    const { occurences, contributions } = this
    return {
      occurences,
      contributions
    }
  }
}
