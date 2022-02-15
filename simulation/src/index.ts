import NodesManager from './manager'
import TreeNode from './treeNode'

const depth = 3
const fanout = 4
const groupSize = 3

const { node: root } = TreeNode.createTree(
  depth,
  fanout,
  groupSize,
  0
)
const manager = NodesManager.createFromTree(root)

root.log()
manager.log()
