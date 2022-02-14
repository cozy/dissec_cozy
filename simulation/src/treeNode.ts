class TreeNode {
  id: number
  parents: number[]
  members: number[]
  children: TreeNode[]

  constructor(id: number, groupSize: number) {
    this.id = id
    this.parents = []
    this.members = new Array(groupSize).fill(id).map((e, i) => e + i)
    this.children = []
  }

  /**
   * Creates a regular tree
   *
   * @param depth The depth of the created tree
   * @param fanout The number of children each parent has
   * @param groupSize The number of members in each group
   * @param id The id of the first member of the root
   * @returns {nextId, node} The number of node created and the root of the tree
   */
  static createTree(
    depth: number,
    fanout: number,
    groupSize: number,
    id: number
  ): { nextId: number; node: TreeNode } {
    const node = new TreeNode(id, groupSize)
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
  findNode(id: number): { node?: TreeNode; position?: number } {
    let index: number
    if (id === this.id) {
      return { node: this, position: 0 }
    } else if ((index = this.members.indexOf(id)) >= 0) {
      return { node: this, position: index }
    } else if ((index = this.children.map(e => e.id).indexOf(id)) >= 0) {
      // Finding an index means the child is safe to use
      return { node: this.children[index], position: index }
    } else {
      for (const child of this.children) {
        const { node, position } = child.findNode(id)
        if (node) {
          return { node, position }
        }
      }
      return {}
    }
  }
}

export default TreeNode
