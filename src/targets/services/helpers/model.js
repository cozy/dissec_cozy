import vocabulary from './vocabulary.json'
import classes from './classes.json'

const add2DArray = (a, b) => {
  let result = a
  for (let j = 0; j < a.length; j++) {
    for (let i = 0; i < a[i].length; i++) {
      result[j][i] = a[j][i] + b[j][i]
    }
  }
  return result
}

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
  }

  static fromBackup(doc) {
    let model = new Model()
    model.uniqueY = doc.uniqueY
    model.occurences = doc.occurences
    model.contributions = doc.contributions
    model.initialize()
    return model
  }

  static fromShares(shares, finalize) {
    let model = new Model()

    model.occurences = shares[0].occurences
    model.contributions = shares[0].contributions
    for (let i = 1; i < shares.length; i++) {
      model.occurences = add2DArray(model.occurences, shares[i].occurences)
      model.contributions += shares[i].contributions
    }

    if (finalize) {
      for (let j = 0; j < vocabulary.length; j++) {
        for (let i = 0; i < this.uniqueY.length; i++) {
          model.occurences[j][i] /= model.contributions
        }
      }

      model.initialize()
    }

    return model
  }

  static fromDocs(docs) {
    let model = new Model()

    for (let doc of docs) {
      // Only learn from categorized docs
      if (doc.cozyCategoryId) {
        const classId = model.uniqueY.indexOf(doc.cozyCategoryId)
        const tokens = doc.label.split(' ')

        console.log(`Doc ${doc.id} has been manually classified with ${doc.cozyCategoryId}. Tokens = [${tokens}]`)

        for (const token of tokens) {
          const index = vocabulary.indexOf(token)
          if (index >= 0) {
            console.log('incrementing', token, index, classId)
            model.occurences[index][classId] += 1
            model.priors[classId] += 1
            console.log(JSON.stringify(model.occurences[index]))
          }
        }
      }
    }

    const tokenSum = model.priors.reduce((a, b) => a + b)
    model.priors = model.priors.map(prior => prior / tokenSum)

    model.initialize()

    return model
  }

  initialize() {
    for (const j in vocabulary) {
      const total = this.occurences[j].reduce((a, b) => a + b)
      for (const i in this.uniqueY) {
        this.logProbabilities[j][i] = Math.log(
          this.occurences[j][i] / total
        )
      }
    }
  }

  train(docs) {
    for (let doc of docs) {
      // Only learn from categorized docs
      if (doc.cozyCategoryId) {
        const classId = model.uniqueY.indexOf(doc.cozyCategoryId)
        const tokens = doc.label.split(' ')

        for (const token of tokens) {
          const index = vocabulary.indexOf(token)
          if (index >= 0) {
            model.occurences[index][classId] += 1
            model.priors[classId] += 1
          }
        }
      }
    }

    model.initialize()
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
    console.log(`For "${text}", predicted ${result} (${probability})`)
    return this.uniqueY[result]
  }

  getShares(security) {
    // Initialize shares array
    let shares = Array(security).fill({
      occurences: this.occurences,
      contributions: this.contributions
    })

    for (let j = 0; j < vocabulary.length; j++) {
      for (let i = 0; i < this.uniqueY.length; i++) {
        // Generate noises
        let finalNoise = 0
        for (let k = 0; k < security - 1; k++) {
          const noise = Math.random() * (Number.MAX_VALUE / security)
          shares[k].occurences[j][i] += noise
          finalNoise += noise
        }
        shares[security - 1].occurences[j][i] -= finalNoise
      }
    }

    return shares
  }

  getBackup() {
    return {
      occurences: this.occurences,
      contributions: this.contributions,
      uniqueY: this.uniqueY
    }
  }
}
