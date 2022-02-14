import TreeNode from './treeNode'

describe('Tree of groups', () => {
  test('Creating a tree', () => {
    const depth = 3
    const fanout = 4
    const groupSize = 3

    const { nextId, node } = TreeNode.createTree(depth, fanout, groupSize, 0)

    expect(nextId).toBe(
      Array(depth + 1)
        .fill(0)
        .map((_, i) => groupSize * fanout ** i)
        .reduce((prev, curr) => prev + curr)
    )
    expect(node.children.length).toBe(fanout)
  })

  test('Finding a child', () => {
    const depth = 3
    const fanout = 4
    const groupSize = 3

    const { nextId, node } = TreeNode.createTree(depth, fanout, groupSize, 0)

    expect(node.findNode(0).node).toBeDefined()
    expect(node.findNode(nextId - 1).node).toBeDefined()
    expect(node.findNode(nextId).node).toBeUndefined()

    const { node: child } = node.findNode(groupSize)
    expect(child).toBeDefined()
    expect(child?.findNode(nextId).node).toBeUndefined()
  })
})
