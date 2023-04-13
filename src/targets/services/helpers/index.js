import largeClasses from '../../../assets/classes.json'
import tinyClasses from '../../../assets/classesTiny.json'
import largeVocabulary from '../../../assets/vocabulary.json'
import tinyVocabulary from '../../../assets/vocabularyTiny.json'

export const SERVICE_CONTRIBUTION = 'contribution'
export const SERVICE_CATEGORIZE = 'categorize'
export const SERVICE_AGGREGATION = 'aggregation'
export const SERVICE_RECEIVE_SHARES = 'receiveShares'

export { createLogger } from './utils'
export * from './files'

const USE_TINY = true
export const vocabulary = USE_TINY ? tinyVocabulary : largeVocabulary
export const classes = USE_TINY ? tinyClasses : largeClasses
