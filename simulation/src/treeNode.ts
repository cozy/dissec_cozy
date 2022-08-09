import cloneDeep from 'lodash/cloneDeep'
import { RunConfig } from './experimentRunner'
import { Generator } from './random'

class TreeNode {
  id: number
  parents: number[]
  members: number[]
  children: TreeNode[]
  depth: number

  constructor(id: number, depth: number) {
    this.id = id
    this.depth = depth
    this.parents = []
    this.members = []
    this.children = []
  }

  static fromCopy(source: TreeNode, id: number): TreeNode {
    const copy = JSON.parse(JSON.stringify(source))
    const node = new TreeNode(id, source.depth)
    node.parents = copy.parents
    node.members = copy.members
    node.children = source.children.map(e => this.fromCopy(e, e.id))
    return node
  }

  copy(): TreeNode {
    return cloneDeep(this)
  }

  static createTree(run: RunConfig, depth: number, id: number): { nextId: number; node: TreeNode } {
    const node = new TreeNode(id, run.depth)
    node.members = Array(run.groupSize)
      .fill(id)
      .map((e, i) => e + i)
    if (depth > 0) {
      let currentId = id + run.groupSize
      for (let i = 0; i < run.fanout; i++) {
        const { nextId, node: child } = TreeNode.createTree(run, depth - 1, currentId)
        child.parents = node.members
        node.children.push(child)
        currentId = nextId
      }
      return { nextId: currentId, node }
    } else {
      const generator = Generator.get(run.seed)
      // Rebalance the number of members in this contributor group
      const numberOfContributors = run.random ? Math.round(Math.sqrt(run.fanout ** (generator() * 2))) : 1

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
   * Finds the node with the given ID below the current node.
   *
   * @param id The id of the searched node
   * @returns The searched node and its position in its group
   */
  findNode(id: number): TreeNode | undefined {
    let index: number
    if (id === this.id) {
      return this
    } else if ((index = this.members.indexOf(id)) >= 0) {
      return TreeNode.fromCopy(this, this.members[index])
    } else if ((index = this.children.map(e => e.id).indexOf(id)) >= 0) {
      return this.children[index]
    } else {
      for (const child of this.children) {
        const node = child.findNode(id)
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
    console.log(`Node #${this.id} (members=${this.members}) has ${this.children.length} children:`)
    for (let i = 0; i < this.children.length; i++) {
      console.group()
      this.children[i].log(depth + 1)
    }
    console.groupEnd()
  }
}

export default TreeNode
