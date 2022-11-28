import { defaultConfig } from './experimentRunner'
import NodesManager from './manager'
import TreeNode from './treeNode'

describe('Manager', () => {
  it('Creates random', () => {
    const run = defaultConfig()
    run.failureRate = 50000
    let { nextId, node: root } = TreeNode.createTree(run, run.depth, 0)

    // Adding the querier group
    const querierGroup = new TreeNode(nextId, run.depth + 1)
    querierGroup.children.push(root)
    querierGroup.members = Array(run.groupSize).fill(nextId)
    root.parents = querierGroup.members

    // Initialize the manager and populate nodes
    const manager = NodesManager.createFromTree(root, {
      ...run,
    })

    manager.setFailures()

    for (const node of Object.values(manager.nodes)) console.log(node.deathTime)
  })
})
