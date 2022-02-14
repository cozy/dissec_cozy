import TreeNode from './treeNode'
import createGenerator from './random'

// Declare a global seeded RNG
declare global {
  var rng: () => number
}

globalThis.rng = createGenerator("42")

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
