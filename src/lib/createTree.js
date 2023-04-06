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
  let matchingNodes = [...remainingNodes]
  let lastLevel = []

  for (let j = 0; j < treeStructure.length; j++) {
    const level = treeStructure[j]
    const currentLevel = []
    matchingNodes = [...remainingNodes]

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
    if (level.numberOfNodes) {
      for (let i = 0; i < level.numberOfNodes; i++) {
        currentLevel.push({
          ...remainingNodes.splice(
            remainingNodes.indexOf(matchingNodes.shift()),
            1
          )[0],
          level: j,
          nbChild:
            j < treeStructure.length - 1
              ? treeStructure[j + 1].numberOfNodes
              : 0,
          parents: j > 0 ? lastLevel : undefined,
          aggregatorId: uuid(),
          finalize: j === 0
        })
      }
    } else {
      while (matchingNodes.length > 0) {
        currentLevel.push({
          ...remainingNodes.splice(
            remainingNodes.indexOf(matchingNodes.shift()),
            1
          )[0],
          level: j,
          nbChild:
            j < treeStructure.length - 1
              ? treeStructure[j + 1].numberOfNodes
              : 0,
          parents: j > 0 ? lastLevel : undefined,
          aggregatorId: uuid(),
          finalize: j === 0
        })
      }
      lastLevel = currentLevel
      break
    }

    lastLevel = [...currentLevel]
  }

  return lastLevel
}

module.exports = createTree
