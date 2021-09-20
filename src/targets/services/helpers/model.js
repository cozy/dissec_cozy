import LZString from 'lz-string'

import vocabulary from '../../../assets/vocabulary_tiny.json'
import classes from './classes.json'

// This constant defines the amplitude of the noise added to shares
// It needs to be small enough to sum all shares without overflows
const NOISE_CEILING = 300000

export class Model {
  constructor() {
    this.uniqueY = Object.keys(classes)
    this.priors = Array(classes.length).fill(1)
    this.occurences = Array(vocabulary.length)
      .fill()
      .map(() =>
        Array(this.uniqueY.length)
          .fill()
          .map(() => 0)
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

  /**
   * Returns a new model created using a model representation
   * 
   * @param {string} doc The aggregate
   * @return {Model} The new model
   */
  static fromAggregate(doc) {
    let model = new Model()
    model.occurences = doc.occurences
    model.contributions = doc.contributions
    model.initialize()
    return model
  }

  /**
   * Returns a new model created using a compressed model representation
   * 
   * @param {string} compressedAggregate The compressed aggregate
   * @return {Model} The new model
   */
  static fromCompressedAggregate(compressedAggregate) {
    const doc = Model.compressedBinaryToShare(compressedAggregate)
    return Model.fromAggregate(doc)
  }

  /**
   * Returns a new model created using shares
   * 
   * @param {Object[]} shares The array of shares
   * @param {boolean} shouldFinalize Used by the final aggregator to produce a usable model
   * @return {Model} The new model
   */
  static fromShares(shares, { shouldFinalize }) {
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

    if (shouldFinalize) {
      for (let j = 0; j < vocabulary.length; j++) {
        for (let i = 0; i < model.uniqueY.length; i++) {
          model.occurences[j][i] /= shares.length
        }
      }

      model.initialize()
    }

    return model
  }

  /**
   * Returns a new model created using compressed shares
   * 
   * @param {string[]} compressedShares The array of compressed shares  
   * @return {Model} The new model
   */
  static fromCompressedShares(compressedShares, options) {
    const shares = compressedShares.map(cshare => {
      //console.log(String(cshare))
      return Model.compressedBinaryToShare(String(cshare))
    })
    return Model.fromShares(shares, options)
  }

  /**
   * Returns a new model trained with the given documents
   * 
   * @param {Object[]} docs An array of documents
   * @return {Model} The new model
   */
  static fromDocs(docs) {
    let model = new Model()

    model.train(docs)

    return model
  }

  /**
   * Internal function used to initialize the model given occurences
   * 
   * @private
   */
  initialize() {
    for (const j in vocabulary) {
      const total = 1 + this.occurences[j].reduce((a, b) => a + b)
      for (const i in this.uniqueY) {
        this.logProbabilities[j][i] = Math.log(
          (1 + this.occurences[j][i]) / total
        )
      }
    }
  }

  /**
   * Updates the model's parameters with the given documents
   * 
   * @param {Object[]} docs An array of documents
   */
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

  /**
   * Predicts the class of a given text sample
   * 
   * @param {string} text The text on which the prediction will be done
   * @return {string} The predicted label
   */
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

  /**
   * Returns the model's shares
   * 
   * @param {Number} nbShares The number of shares to create
   * @return {Object[]} An array of shares
   */
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

  getCompressedShares(nbShares) {
    const shares = this.getShares(nbShares)
    return shares.map(share => Model.shareToCompressedBinary(share))
  }

  /**
   * Returns the model's aggregated parameters
   * 
   * @return {Object} The aggregated model's parameters
   */
  getAggregate() {
    const { occurences, contributions } = this
    return {
      occurences,
      contributions
    }
  }

  /**
   * Returns a compressed version of the model's aggregated parameters
   * 
   * @return {string} The compressed aggregated model's parameters
   */
  getCompressedAggregate() {
    const { occurences, contributions } = this
    return Model.shareToCompressedBinary({
      occurences,
      contributions
    })
  }

  /**
   * Transforms a share into a compressed string representation
   * 
   * @param {Object} share A share object to compress
   * @return {string} the string representing the compressed share
   */
  static shareToCompressedBinary(share) {
    const rows = vocabulary.length
    const cols = Object.keys(classes).length
    const numberSize = 4
    const buf = Buffer.alloc((rows * cols + 1) * numberSize)

    buf.writeInt32BE(share.contributions, 0)
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        buf.writeInt32BE(
          share.occurences[j][i],
          (j * cols + i + 1) * numberSize
        )
      }
    }

    return LZString.compressToBase64(buf.toString('base64'))
  }

  /**
   * Decompresses a share's string representation
   * 
   * @param {string} compressed The compressed share
   * @return {Object} The share object
   */
  static compressedBinaryToShare(compressed) {
    const decompressed = LZString.decompressFromBase64(compressed)
    const buf = Buffer.from(decompressed, 'base64')
    const rows = vocabulary.length
    const cols = Object.keys(classes).length
    const numberSize = 4
    const contributions = buf.readInt32BE()
    const occurences = Array(rows)
      .fill()
      .map(() =>
        Array(cols)
          .fill()
          .map(() => 0)
      )

    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        occurences[j][i] = buf.readInt32BE((j * cols + i + 1) * numberSize)
      }
    }

    return {
      contributions,
      occurences
    }
  }
}
