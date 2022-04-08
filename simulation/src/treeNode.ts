import cloneDeep from "lodash/cloneDeep"

class TreeNode {
  id: number
  parents: number[]
  members: number[]
  children: TreeNode[]

  constructor(id: number) {
    this.id = id
    this.parents = []
    this.members = []
    this.children = []
  }

  static fromCopy(source: TreeNode, id: number): TreeNode {
    const copy = JSON.parse(JSON.stringify(source))
    const node = new TreeNode(id)
    node.parents = copy.parents
    node.members = copy.members
    node.children = source.children.map(e => this.fromCopy(e, e.id))
    return node
  }

  copy(): TreeNode {
    return cloneDeep(this)
  }

  /**
   * Creates a regular tree
   *
   * @param depth The depth of the created tree
   * @param fanout The number of children each parent has
   * @param groupSize The number of members in each group
   * @param id The id of the first member of the root
   * @returns The number of node created and the root of the tree
   */
  static createTree(
    depth: number,
    fanout: number,
    groupSize: number,
    id: number
  ): { nextId: number; node: TreeNode } {
    const node = new TreeNode(id)
    node.members = Array(groupSize)
      .fill(id)
      .map((e, i) => e + i)
    if (depth > 0) {
      let currentId = id + groupSize
      for (let i = 0; i < fanout; i++) {
        const { nextId, node: child } = TreeNode.createTree(
          depth - 1,
          fanout,
          groupSize,
          currentId
        )
        child.parents = node.members
        node.children.push(child)
        currentId = nextId
      }
      return { nextId: currentId, node }
    } else {
      return { nextId: id + groupSize, node }
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
    if(depth === 0) {
      return [this]
    } else {
      return this.children.flatMap(child => child.selectNodesByDepth(depth-1))
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
