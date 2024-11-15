import NaiveBayes from 'classificator'
import { createCategorizer } from 'cozy-konnector-libs/dist/libs/categorization'
import { tokenizer } from 'cozy-konnector-libs/dist/libs/categorization/helpers'
import { getClassifierOptions } from 'cozy-konnector-libs/dist/libs/categorization/localModel/classifier'
import LZUTF8 from 'lzutf8'

import {
  demoVocabulary,
  demoClasses,
  classes,
  tinyClasses,
  tinyVocabulary,
  vocabulary
} from './helpers'

// FIXME: Importing cozy-konnector-libs requires the COZY_CREDENTIALS env var to be in a specific format
// .. To make this work, libs must include this PR: https://github.com/konnectors/libs/pull/851
// This constant defines the amplitude of the noise added to shares
// It needs to be small enough to sum all shares without overflows
const NOISE_CEILING = 300000

export class Model {
  /**
   * @typedef ModelSize
   * @type {'normal' | 'tiny' | 'demo'}
   */
  /**
   * @param {{ modelSize: ModelSize }} options
   */
  constructor({ modelSize = 'demo' } = {}) {
    if (modelSize === 'normal') {
      this.vocabulary = vocabulary
      this.uniqueY = Object.keys(classes)
    } else if (modelSize === 'tiny') {
      this.vocabulary = tinyVocabulary
      this.uniqueY = Object.keys(tinyClasses)
    } else {
      this.vocabulary = demoVocabulary
      this.uniqueY = Object.keys(demoClasses)
    }
    this.classifiers = []

    // Using map to allocate a new array for each line
    this.occurences = Array(this.uniqueY.length)
      .fill(0)
      .map(() => Array(this.vocabulary.length).fill(0))
    this.contributions = 1
  }

  /**
   * Internal function used to initialize occurrences based on a classifier
   *
   * @private
   */
  initializeOccurences() {
    // Copy the classificator into the occurences matrix
    for (const category of Object.keys(
      this.classifiers[0].wordFrequencyCount
    )) {
      const catIndex = this.uniqueY.findIndex(e => e == category)
      if (catIndex === -1) continue
      for (const token of Object.keys(
        this.classifiers[0].wordFrequencyCount[category]
      )) {
        const wordIndex = this.vocabulary.findIndex(e => e == token)
        if (wordIndex === -1) continue
        this.occurences[catIndex][
          wordIndex
        ] = this.classifiers[0].wordFrequencyCount[category][token]
      }
    }
  }

  /**
   * Internal function used to initialize the classifier given occurences
   *
   * @private
   */
  initializeClassifier() {
    if (this.classifiers.length !== 0)
      throw new Error('Initializing non empty classifiers')

    const classifier = NaiveBayes({
      tokenizer,
      ...getClassifierOptions(this.uniqueY.length).initialization
    })
    this.uniqueY.forEach(category => classifier.initializeCategory(category))

    for (let j = 0; j < this.uniqueY.length; j++) {
      for (let i = 0; i < this.vocabulary.length; i++) {
        // Keep the matrix sparse by skiping zeroes
        if (this.occurences[j][i] === 0) continue

        // Initialize word
        if (!classifier.wordFrequencyCount[this.uniqueY[j]][this.vocabulary[i]])
          classifier.wordFrequencyCount[this.uniqueY[j]][this.vocabulary[i]] = 0
        if (!classifier.vocabulary[this.vocabulary[i]])
          classifier.vocabulary[this.vocabulary[i]] = 0

        classifier.wordFrequencyCount[this.uniqueY[j]][
          this.vocabulary[i]
        ] += this.occurences[j][i]
        classifier.vocabulary[this.vocabulary[i]] += this.occurences[j][i]
        classifier.wordCount[this.uniqueY[j]] += this.occurences[j][i]
      }
    }

    classifier.vocabularySize = this.vocabulary.length
    this.classifiers = [classifier]
  }

  /**
   * @typedef CreateModelFromAggregateOptions
   * @type {object}
   * @property {boolean} useGlobalModel
   * @property {ModelSize} modelSize
   */

  /**
   * Returns a new model created using a model representation
   *
   * @param {Object} doc The aggregate
   * @param {CreateModelFromAggregateOptions} options Use the global model as well
   * @return {Promise<Model>} The new model
   */
  static async fromAggregate(
    doc,
    { useGlobalModel = false, modelSize = 'demo' } = {}
  ) {
    let model = new Model({ modelSize })
    model.occurences = doc.occurences
    model.contributions = doc.contributions
    model.initializeClassifier()
    const { categorize } = await createCategorizer({
      useGlobalModel,
      pretrainedClassifier: model.classifiers[0]
    })
    model.categorize = categorize
    return model
  }

  /**
   * Returns a new model created using a compressed model representation
   *
   * @param {string} compressedAggregate The compressed aggregate
   * @param {CreateModelFromAggregateOptions} options
   * @return {Promise<Model>} The new model
   */
  static async fromCompressedAggregate(
    compressedAggregate,
    { useGlobalModel = false, modelSize = 'demo' } = {}
  ) {
    const doc = Model.compressedBinaryToShare(compressedAggregate)
    return await Model.fromAggregate(doc, { modelSize, useGlobalModel })
  }

  /**
   * @typedef ModelCreationOptions
   * @type {object}
   * @property {boolean} shouldFinalize - Whether to finalize the model
   * @property {ModelSize} modelSize - The size of the model
   */

  /**
   * Returns a new model created using shares
   *
   * @param {Object[]} shares The array of shares
   * @param {ModelCreationOptions} options Reconstruction options
   * @return {Model} The new model
   */
  static fromShares(
    shares,
    { shouldFinalize = false, modelSize = 'demo' } = {}
  ) {
    // TODO: Do not write an occurences matrix, only the wordFrequencyCount
    let model = new Model({ modelSize })
    model.contributions = 0
    shares.forEach(share => (model.contributions += share.contributions))

    for (let j = 0; j < model.uniqueY.length; j++) {
      for (let i = 0; i < model.vocabulary.length; i++) {
        let acc = 0
        for (let k = 0; k < shares.length; k++) {
          acc += shares[k].occurences[j][i]
        }
        model.occurences[j][i] = acc
      }
    }

    if (shouldFinalize) {
      for (let j = 0; j < model.uniqueY.length; j++) {
        for (let i = 0; i < model.vocabulary.length; i++) {
          model.occurences[j][i] /= shares.length
        }
      }
    }

    model.initializeClassifier()

    return model
  }

  /**
   * Returns a new model created using compressed shares
   *
   * @param {string[]} compressedShares The array of compressed shares
   * @param {ModelCreationOptions} options Reconstruction options
   * @return {Model} The new model
   */
  static fromCompressedShares(
    compressedShares,
    { shouldFinalize = false, modelSize = 'demo' } = {}
  ) {
    const shares = compressedShares.map(cshare => {
      return Model.compressedBinaryToShare(String(cshare))
    })
    return Model.fromShares(shares, { shouldFinalize, modelSize })
  }

  /**
   * @typedef CreateModelFromDocsOptions
   * @type {object}
   * @property {boolean} useGlobalModel
   * @property {ModelSize} modelSize
   */

  /**
   * Returns a new model trained with the given documents
   *
   * @param {object[]} docs An array of documents
   * @param {CreateModelFromDocsOptions} options Use the global model as well
   * @return {Promise<Model>} The new model
   */
  static async fromDocs(
    docs,
    { useGlobalModel = false, modelSize = 'demo' } = {}
  ) {
    const model = new Model({ modelSize })
    const { categorize, classifiers } = await createCategorizer({
      useGlobalModel,
      customTransactionFetcher: () => docs.filter(tx => tx.manualCategoryId)
    })
    model.classifiers = classifiers
    model.categorize = categorize

    model.initializeOccurences()

    return model
  }

  /**
   * Predicts the class of a given text sample
   *
   * @param {string} label The text on which the prediction will be done
   * @return {string} The predicted label
   */
  predict(label) {
    const result = this.categorize([{ label }])
    return result[0].localCategoryId
  }

  /**
   * Continue training on more data.
   *
   * @param {object[]} operations Cozy banks operations
   */
  train(operations) {
    for (const operation of operations) {
      const tokens = tokenizer(operation.label)
      const catIndex = this.uniqueY.indexOf(operation.manualCategoryId)
      if (catIndex === -1) continue
      for (const token of tokens) {
        const tokenIndex = this.vocabulary.indexOf(token)
        if (tokenIndex === -1) continue
        this.occurences[catIndex][tokenIndex] += 1
      }
    }

    this.initializeClassifier()
  }

  /**
   * Preprocessing to normalize tokens
   *
   * @param {string[]} tokens The raw array of tokens
   * @return {string[]}
   */
  static normalizeTokens(tokens) {
    return tokens.map(e => e.toLowerCase())
  }

  /**
   * Returns the model's shares
   *
   * @param {Number} nbShares The number of shares to create
   * @return {Object[]} An array of shares
   */
  getShares(nbShares) {
    // Make a copy for each share
    let shares = Array(nbShares)
      .fill(0)
      .map(() => {
        return {
          occurences: this.occurences.map(e => e.map(f => f)),
          contributions: this.contributions
        }
      })

    // Add noise on top of shares
    for (let j = 0; j < this.uniqueY.length; j++) {
      for (let i = 0; i < this.vocabulary.length; i++) {
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
    return this.getShares(nbShares).map(share =>
      Model.shareToCompressedBinary(share)
    )
  }

  /**
   * Returns the model's aggregated parameters
   *
   * @return {Object} The aggregated model's parameters
   */
  getAggregate() {
    return {
      occurences: this.occurences,
      contributions: this.contributions
    }
  }

  /**
   * Returns a compressed version of the model's aggregated parameters
   *
   * @return {string} The compressed aggregated model's parameters
   */
  getCompressedAggregate() {
    return Model.shareToCompressedBinary({
      occurences: this.occurences,
      contributions: this.contributions
    })
  }

  /**
   * Transforms a share into a compressed string representation
   *
   * @param {Object} share A share object to compress
   * @param {{ modelSize: ModelSize }} options
   * @return {string} the string representing the compressed share
   */
  static shareToCompressedBinary(share, { modelSize = 'demo' } = {}) {
    let vocab
    let uniqueY
    if (modelSize === 'normal') {
      vocab = vocabulary
      uniqueY = Object.keys(classes)
    } else if (modelSize === 'tiny') {
      vocab = tinyVocabulary
      uniqueY = Object.keys(tinyClasses)
    } else {
      vocab = demoVocabulary
      uniqueY = Object.keys(demoClasses)
    }
    const rows = uniqueY.length
    const cols = vocab.length
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

    return LZUTF8.compress(buf.toString('base64'), {
      outputEncoding: 'StorageBinaryString'
    })
  }

  /**
   * Decompresses a share's string representation
   *
   * @param {string} compressed The compressed share
   * @param {{ modelSize: ModelSize }} options
   * @return {Object} The share object
   */
  static compressedBinaryToShare(compressed, { modelSize = 'demo' } = {}) {
    let vocab
    let uniqueY
    if (modelSize === 'normal') {
      vocab = vocabulary
      uniqueY = Object.keys(classes)
    } else if (modelSize === 'tiny') {
      vocab = tinyVocabulary
      uniqueY = Object.keys(tinyClasses)
    } else {
      vocab = demoVocabulary
      uniqueY = Object.keys(demoClasses)
    }
    const decompressed = LZUTF8.decompress(compressed, {
      inputEncoding: 'StorageBinaryString'
    })
    const buf = Buffer.from(decompressed, 'base64')
    const rows = uniqueY.length
    const cols = vocab.length
    const numberSize = 4
    const contributions = buf.readInt32BE()
    const occurences = Array(rows)
      .fill(0)
      .map(() => Array(cols).fill(0))

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
