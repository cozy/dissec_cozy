/**
 * FIXME: THIS FILE IS A WORKAROUND TO CONFLICTING IMPORT STYLES.
 * This file is a duplicate but uses the `export` keyword (ECMAScript).
 * The old file was using `require` (CommonJS) which causes an error either in the frontend or when running scripts
 */

import { v4 as uuid } from 'uuid'

/**
 * @typedef TreeDescription
 * @property {number} depth Depth of the tree
 * @property {number} fanout Number of children per node
 * @property {number} groupSize  Nodes per group
 */

/**
 * This function is used to create the aggregation tree
 *
 * @param {TreeDescription} treeStructure The structure defining the tree
 * @param {Webhooks[]} nodesWebhooks The list of webhooks used by nodes
 * @returns
 */
const createTree = (treeStructure, nodesWebhooks) => {
  const executionId = uuid()
  let remainingWebhooks = [...nodesWebhooks]

  const createLevel = (parentGroup, depth) => {
    const childrenToCreate = parentGroup.length === 0 ? 1 : treeStructure.fanout
    let groupSize
    if (parent.length === 0) {
      // Querier node
      groupSize = 1
    } else if (depth === treeStructure.depth - 1) {
      // Leaf aggregators
      treeStructure.fanout
    } else {
      // Aggregator
      treeStructure.groupSize
    }
    const currentGroup = []
    const groupId = uuid()

    // Create group
    for (let i = 0; i < groupSize; i++) {
      const webhooks = remainingWebhooks.shift()
      remainingWebhooks.push(webhooks) // Cycle the elements

      const { label, contributionWebhook, aggregationWebhook } = webhooks
      let node = {
        label,
        contributionWebhook,
        aggregationWebhook,
        level: depth,
        role:
          depth === 0
            ? 'Querier'
            : depth === treeStructure.depth - 2
            ? 'Leaf'
            : depth === treeStructure.depth - 1
            ? 'Contributor'
            : 'Aggregator',
        treeStructure,
        nbChild: treeStructure.fanout,
        parents: undefined,
        nodeId: uuid(),
        executionId,
        groupId,
        finalize: depth === 0
      }
      if (parentGroup.length > 0 && depth < treeStructure.depth - 2) {
        // Intermediate group
        node.parents = [parentGroup[i]]
      } else if (parentGroup.length > 0) {
        // Contributors
        node.parents = parentGroup
      }

      currentGroup.push(node)
    }

    currentGroup.forEach(node => (node.group = currentGroup.map(e => e.nodeId)))

    // The querier contains the same node multiple times
    if (parentGroup.length === 0) {
      currentGroup.push(
        ...Array(treeStructure.groupSize - 1).fill(currentGroup[0])
      )
    }

    // Create aggregators
    if (depth < treeStructure.depth - 2) {
      const children = []
      for (let i = 0; i < childrenToCreate; i++) {
        children.push(createLevel(currentGroup, depth + 1))
      }
      return children.flat()
    } else if (depth < treeStructure.depth - 1) {
      return createLevel(currentGroup, depth + 1)
    } else {
      return currentGroup
    }
  }

  return createLevel([], 0)
}

export default createTree
