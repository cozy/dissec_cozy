export const capitalizeFirstLetter = str => {
  return str.charAt(0).toUpperCase() + str.substring(1, str.length)
}

// https://github.com/cozy/cozy-banks/blob/master/docs/categorization.md#category-choice
export const getBestCategory = bankOperation => {
  return (
    bankOperation.manualCategoryId ||
    bankOperation.localCategoryId ||
    bankOperation.cozyCategoryId ||
    bankOperation.automaticCategoryId
  )
}
