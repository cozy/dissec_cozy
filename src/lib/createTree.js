const { v4: uuid } = require('uuid')

/**
 * This function is used to create the aggregation tree
 *
 * @param {TreeLevelDescriptor[]} treeStructure The structure defining the tree
 * @param {Webhooks[]} nodesWebhooks The list of webhooks used by nodes
 * @param {boolean} allowReuse Reuse nodes in the tree
 * @returns
 */
const createTree = (treeStructure, nodesWebhooks, allowReuse = true) => {
  let remainingNodes = [...nodesWebhooks]
  let nodesCopy = [...nodesWebhooks]
  let matchingNodes = [...remainingNodes]
  let lastLevel = []

  const refillNodes = () => {
    if (allowReuse && remainingNodes.length === 0) {
      remainingNodes = [...nodesCopy]
    }
  }

  for (let j = 0; j < treeStructure.length; j++) {
    const level = treeStructure[j]
    const currentLevel = []
    matchingNodes = [...remainingNodes]

    // Apply filters if there are any
    if (level.mustInclude) {
      if (level.mustInclude.length < level.numberOfNodes) {
        throw new Error(
          'Invalid tree structure: the "mustInclude" parameter must match the number of nodes'
        )
      } else {
        matchingNodes = remainingNodes.filter(node =>
          level.mustInclude.includes(node.label)
        )
      }
    }

    // Move nodes to the current level
    if (level.numberOfNodes) {
      // The level has a valid number of nodes, add exactly that amount
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
          nodeId: uuid(),
          finalize: j === 0
        })

        refillNodes()
      }
    } else {
      // Undefined number of nodes means add all remaining nodes
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
          nodeId: uuid(),
          finalize: j === 0
        })

        refillNodes()
      }
      lastLevel = currentLevel
      break
    }

    lastLevel = [...currentLevel]
  }

  return lastLevel
}

module.exports = createTree
