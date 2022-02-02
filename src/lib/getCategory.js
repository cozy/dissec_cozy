const getCategory = doc => {
  return doc.manualCategoryId || doc.localCategoryId || doc.cozyCategoryId
}

module.exports = getCategory
