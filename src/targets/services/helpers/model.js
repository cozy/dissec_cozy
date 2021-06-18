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
  static fromBackup(doc) {
    let model = new Model()
    model.uniqueY = doc.uniqueY
    model.occurences = doc.occurences
    model.contributions = doc.contributions
    return model
  }

  static fromShares(shares, finalize) {
    let model = new Model()
    model.uniqueY = Object.keys(classes)

    model.occurences = shares.occurences[0]
    model.contributions = shares.contributions[0]
    for (let i = 1; i < shares.length; i++) {
      model.occurences = add2DArray(model.occurences, shares[i].occurences)
      model.contributions += shares[i].contributions
    }

    if (finalize) {
      for (let j = 0; j < vocabulary.length; j++) {
        for (let i = 0; i < classes.length; i++) {
          model.occurences[j][i] /= model.contributions
        }
      }

      model.probabilities = new Array(vocabulary.length).map((_, i) =>
        model.occurences[i].map(
          val =>
            val /
            model.occurences[i].reduce((previous, current) => {
              previous + current
            })
        )
      )
    }
  }

  static fromDocs(docs) {
    let model = new Model()

    model.uniqueY = Object.keys(classes)
    model.priors = new Array(classes.length).map(() => 0)

    for (let i = 0; i < docs.length; i++) {
      if (docs.cozyCategoryId) {
        const classId = model.uniqueY.indexOf(docs.cozyCategoryId)
        const tokens = docs.label.split(' ')

        for (const token of tokens) {
          const index = vocabulary.indexOf(token)
          if (index >= 0) {
            model.occurences[token][classId] += 1
            model.priors[classId] += 1
          }
        }
      }
    }

    const tokenSum = model.priors.reduce(
      (previous, current) => previous + current
    )
    model.priors = model.priors.map(prior => prior / tokenSum)

    model.probabilities = new Array(vocabulary.length).map((_, i) =>
      model.occurences[i].map(
        val =>
          (model.priors[i] * val) /
          model.occurences[i].reduce((previous, current) => {
            previous + current
          })
      )
    )
  }

  predict(text) {
    let probability = new Array(classes.length).map(() => 1)
    const tokens = text.split(' ')

    for (const token of tokens) {
      const index = vocabulary.indexOf(token)
      if (index >= 0) {
        for (let i in this.uniqueY) {
          probability[i] *= this.probabilities[token][i]
        }
      }
    }

    return Math.max([...probability.map((proba, i) => proba * this.priors[i])])
  }

  getShares(security) {
    // Initialize shares array
    let shares = new Array(security).map(() => {
      return {
        occurences: this.occurences,
        contributions: this.contributions
      }
    })

    for (let j = 0; j < vocabulary.length; j++) {
      for (let i = 0; i < classes.length; i++) {
        // Generate noises
        let finalNoise = 0
        for (let k = 0; k < security - 1; k++) {
          const noise = Math.random() * (Number.MAX_VALUE / security)
          shares[k].occurences[j][i] += noise
          finalNoise += noise
        }
        shares[security - 1].occurences[j][i] += finalNoise
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
