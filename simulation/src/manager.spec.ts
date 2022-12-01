import { defaultConfig } from './experimentRunner'
import NodesManager from './manager'
import TreeNode from './treeNode'

describe('Manager', () => {
  it('Initializes from a tree', () => {
    const run = defaultConfig()
    run.failureRate = 50000
    let { nextId, node: root } = TreeNode.createTree(run, run.depth, 0)

    // Adding the querier group
    const querierGroup = new TreeNode(run.depth + 1)
    querierGroup.children.push(root)
    querierGroup.members = Array(run.groupSize).fill(nextId)
    root.parents = querierGroup.members

    // Initialize the manager and populate nodes
    const manager = NodesManager.createFromTree(root, {
      ...run,
    })

    const checkGroup = (node: TreeNode) => {
      expect(node.parents.length).toBe(run.groupSize)

      if (node.depth !== 0) {
        expect(node.members.length).toBe(run.groupSize)
        expect(node.children.length).toBe(run.fanout)
      } else {
        expect(node.members.length).toBe(1)
        expect(node.children.length).toBe(0)
      }
    }

    Object.values(manager.nodes).forEach(n => checkGroup(n.node!))
  })

  it('Creates random nodes', () => {
    const run = defaultConfig()
    run.failureRate = 50000
    let { nextId, node: root } = TreeNode.createTree(run, run.depth, 0)

    // Adding the querier group
    const querierGroup = new TreeNode(run.depth + 1)
    querierGroup.children.push(root)
    querierGroup.members = Array(run.groupSize).fill(nextId)
    root.parents = querierGroup.members

    // Initialize the manager and populate nodes
    const manager = NodesManager.createFromTree(root, {
      ...run,
    })

    manager.setFailures()
  })
})
