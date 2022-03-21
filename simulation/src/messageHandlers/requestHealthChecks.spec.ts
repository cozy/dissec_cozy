import { NodeRole } from "../node"
import NodesManager from "../manager"
import { Message, MessageType } from "../message"
import TreeNode from "../treeNode"

describe('Request health check', () => {
  const depth = 3
  const fanout = 4
  const groupSize = 3

  let root: TreeNode
  let manager: NodesManager

  beforeEach(() => {
    const { node } = TreeNode.createTree(depth, fanout, groupSize, 0)
    root = node
    manager = NodesManager.createFromTree(root)
  })

  it('should make the querier request health from all members of the child group', async () => {
    const receptionTime = 10
    const treenode = root.children[0]
    const node = manager.nodes[root.id]
    const children = node.node!.children[0].members
    node.role = NodeRole.Querier

    let messages = node.receiveMessage(new Message(
      MessageType.RequestHealthChecks,
      0,
      receptionTime,
      treenode.id,
      root.id,
      {}
    ))

    expect(messages.length).toBe(groupSize + 2) // Timeout + reschedule
    expect(Object.keys(node.ongoingHealthChecks).map(Number)).toStrictEqual(children)
  })

  it('should request health check from children who sent data', async () => {
    const receptionTime = 10
    const treenode = root.children[0]
    const node = manager.nodes[root.id]
    node.role = NodeRole.Querier
    const children = node.node!.children[0].members
    node.aggregates[children[0]] = { data: 0, counter: 1 }

    let messages = node.receiveMessage(new Message(
      MessageType.RequestHealthChecks,
      0,
      receptionTime,
      root.id,
      treenode.id,
      {}
    ))

    expect(messages.length).toBe(groupSize + 2)
    expect(Object.keys(node.ongoingHealthChecks).map(Number)).toStrictEqual(children)
  })

  it('should fail when the node does not know the tree', async () => {
    const receptionTime = 10
    const treenode = root.children[0]
    const message = new Message(
      MessageType.RequestHealthChecks,
      0,
      receptionTime,
      root.id,
      treenode.id,
      {}
    )
    const node = manager.nodes[treenode.id]
    node.node = undefined
    expect(() => node.receiveMessage(message)).toThrow()
  })
})
