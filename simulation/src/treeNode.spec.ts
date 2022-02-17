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

    expect(node.findNode(0)).toBeDefined()
    expect(node.findNode(nextId - 1)).toBeDefined()
    expect(node.findNode(nextId)).toBeUndefined()

    const child = node.findNode(groupSize)
    expect(child).toBeDefined()
    expect(child?.findNode(nextId)).toBeUndefined()
  })

  test('Select nodes by depth', () => {
    const depth = 3
    const fanout = 4
    const groupSize = 3
    const { node } = TreeNode.createTree(depth, fanout, groupSize, 0)

    for(let i=0; i<=depth; i++) {
      expect(node.selectNodesByDepth(i).length).toBe(fanout ** i)
    }

    expect(node.selectNodesByDepth(depth + 1).length).toBe(0)
  })
})
