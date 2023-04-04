const { v4: uuid } = require('uuid')

/**
 * This function is used to create the aggregation tree
 *
 * @param {object} treeStructure The structure defining the tree
 * @param {Webhooks[]} nodesWebhooks The list of webhooks used by nodes
 * @returns
 */
const createTree = (treeStructure, nodesWebhooks) => {
  let remainingNodes = nodesWebhooks
  let matchingNodes = remainingNodes.slice()
  let lastLevel = []

  treeStructure.forEach((level, j) => {
    const currentLevel = []
    matchingNodes = remainingNodes.slice()

    // Apply filters if there are any
    if (level.mustInclude) {
      if (level.mustInclude.length < level.numberOfNodes) {
        throw new Error(
          'Invalid tree structure: level not including enough nodes'
        )
      } else {
        matchingNodes = remainingNodes.filter(node =>
          level.mustInclude.includes(node.label)
        )
      }
    }

    // Move nodes to the current level
    for (let i = 0; i < level.numberOfNodes; i++) {
      currentLevel.push({
        ...remainingNodes.splice(
          remainingNodes.indexOf(matchingNodes.shift()),
          1
        )[0],
        level: j,
        nbChild:
          j < treeStructure.length - 1 ? treeStructure[j + 1].numberOfNodes : 0,
        parents: j > 0 ? lastLevel : undefined,
        aggregatorId: uuid(),
        finalize: j === 0
      })
    }

    lastLevel = currentLevel.slice()
  })

  return lastLevel
}

module.exports = createTree
