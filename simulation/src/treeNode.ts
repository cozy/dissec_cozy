import cloneDeep from 'lodash/cloneDeep'

import { RunConfig } from './experimentRunner'

class TreeNode {
  parents: number[]
  members: number[]
  children: TreeNode[]
  depth: number

  constructor(depth: number) {
    this.depth = depth
    this.parents = []
    this.members = []
    this.children = []
  }

  copy(): TreeNode {
    return cloneDeep(this)
  }

  equals(other: TreeNode) {
    const members = other.members.map(member => !this.members.includes(member)).filter(Boolean).length === 0
    const parents = other.parents.map(parent => !this.parents.includes(parent)).filter(Boolean).length === 0
    return members && parents
  }

  static createTree(
    run: RunConfig,
    depth: number,
    id: number,
    generator: () => number
  ): { nextId: number; node: TreeNode } {
    const node = new TreeNode(depth)
    node.members = Array(run.groupSize)
      .fill(id)
      .map((e, i) => e + i)
    if (depth > 0) {
      let currentId = id + run.groupSize
      for (let i = 0; i < run.fanout; i++) {
        const { nextId, node: child } = TreeNode.createTree(run, depth - 1, currentId, generator)
        child.parents = node.members
        node.children.push(child)
        currentId = nextId
      }
      return { nextId: currentId, node }
    } else {
      // Rebalance the number of members in this contributor group
      const numberOfContributors = run.random
        ? Math.round(run.fanout ** (generator() + run.concentration))
        : run.fanout ** run.concentration

      if (node.members.length > numberOfContributors) {
        // Removing contributors from the group
        const toRemove = node.members.length - numberOfContributors
        for (let i = 0; i < toRemove; i++) {
          node.members.splice(-1, 1)
        }
      } else if (node.members.length < numberOfContributors) {
        // Adding contributors to the group
        const toAdd = numberOfContributors - node.members.length
        for (let i = 0; i < toAdd; i++) {
          node.members.push(id + run.groupSize + i)
        }
      }

      return { nextId: id + numberOfContributors, node }
    }
  }

  /**
   * Finds the group where a member has the given ID below the current node.
   *
   * @param id The id of the searched node
   * @returns The searched node and its position in its group
   */
  findGroup(id: number): TreeNode | undefined {
    let index: number
    if ((index = this.members.indexOf(id)) >= 0) {
      return this
    } else if ((index = this.children.map(e => e.members.includes(id)).indexOf(true)) >= 0) {
      return this.children[index]
    } else {
      for (const child of this.children) {
        const node = child.findGroup(id)
        if (node) {
          return node
        }
      }
      return
    }
  }

  selectNodesByDepth(depth: number): TreeNode[] {
    if (depth === 0) {
      return [this]
    } else {
      return this.children.flatMap(child => child.selectNodesByDepth(depth - 1))
    }
  }

  log(depth: number = 1) {
    console.log(`Group [${this.members.map(e => '#' + e)}] has ${this.children.length} children:`)
    for (let i = 0; i < this.children.length; i++) {
      console.group()
      this.children[i].log(depth + 1)
    }
    console.groupEnd()
  }
}

export default TreeNode
