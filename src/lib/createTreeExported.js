/**
 * FIXME: THIS FILE IS A WORKAROUND TO CONFLICTING IMPORT STYLES.
 * This file is a duplicate but uses the `export` keyword (ECMAScript).
 * The old file was using `require` (CommonJS) which causes an error either in the frontend or when running scripts
 */

import { v4 as uuid } from 'uuid'

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
        const {
          label,
          contributionWebhook,
          aggregationWebhook
        } = remainingNodes.splice(
          remainingNodes.indexOf(matchingNodes.shift()),
          1
        )[0]
        currentLevel.push({
          label,
          contributionWebhook,
          aggregationWebhook,
          level: j,
          nbChild:
            j < treeStructure.length - 1
              ? treeStructure[j + 1].numberOfNodes
              : 0,
          parents: j > 0 ? lastLevel : undefined,
          aggregatorId: uuid(),
          finalize: j === 0
        })

        refillNodes()
      }
    } else {
      // Undefined number of nodes means add all remaining nodes
      while (matchingNodes.length > 0) {
        const {
          label,
          contributionWebhook,
          aggregationWebhook
        } = remainingNodes.splice(
          remainingNodes.indexOf(matchingNodes.shift()),
          1
        )[0]
        currentLevel.push({
          label,
          contributionWebhook,
          aggregationWebhook,
          level: j,
          nbChild:
            j < treeStructure.length - 1
              ? treeStructure[j + 1].numberOfNodes
              : 0,
          parents: j > 0 ? lastLevel : undefined,
          aggregatorId: uuid(),
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

export default createTree
