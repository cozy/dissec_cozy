import { NodeRole } from "../node"
import NodesManager from "../manager"
import { Message, MessageType } from "../message"
import TreeNode from "../treeNode"

describe('Send aggregate', () => {
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

  it('should make the querier add the aggregate to its buffer and finalize the computation if possible', async () => {
    const receptionTime = 10
    const agg1 = { data: 42, counter: 1 }
    const treenode = root.children[0]
    const node = manager.nodes[root.id]
    node.role = NodeRole.Querier

    let messages = node.receiveMessage(new Message(
      MessageType.SendAggregate,
      0,
      receptionTime,
      treenode.id,
      root.id,
      { aggregate: agg1 }
    ))

    expect(node.aggregates[treenode.id]).toStrictEqual(agg1)
    expect(messages.length).toBe(0)

    messages = node.receiveMessage(new Message(
      MessageType.SendAggregate,
      0,
      receptionTime,
      root.children[1].members[0],
      root.id,
      { aggregate: agg1 }
    ))

    expect(node.aggregates[root.children[1].members[0]]).toStrictEqual(agg1)
    expect(messages.length).toBe(0)

    messages = node.receiveMessage(new Message(
      MessageType.SendAggregate,
      0,
      receptionTime,
      root.children[2].members[0],
      root.id,
      { aggregate: agg1 }
    ))

    expect(node.aggregates[root.children[2].members[0]]).toStrictEqual(agg1)
    expect(node.finishedWorking).toBeTruthy()
    expect(messages.length).toBe(1)
  })

  it('should fail when the node does not know the tree', async () => {
    const receptionTime = 10
    const treenode = root.children[0]
    const message = new Message(
      MessageType.SendAggregate,
      0,
      receptionTime,
      root.id,
      treenode.id,
      { aggregate: { data: 0, counter: 1 } }
    )
    const node = manager.nodes[treenode.id]
    node.node = undefined
    expect(() => node.receiveMessage(message)).toThrow()
  })

  it('should fail when the node does not receive the aggregate', async () => {
    const receptionTime = 10
    const treenode = root.children[0]
    const message = new Message(
      MessageType.SendAggregate,
      0,
      receptionTime,
      root.id,
      treenode.id,
      {}
    )
    const node = manager.nodes[treenode.id]
    expect(() => node.receiveMessage(message)).toThrow()
  })
})
