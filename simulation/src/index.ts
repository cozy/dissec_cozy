import TreeNode from './node'

const depth = 3
const fanout = 4
const groupSize = 3

const { nextId: numberOfNodes, node: root } = TreeNode.createTree(
  depth,
  fanout,
  groupSize,
  0
)

console.log(root, numberOfNodes)
