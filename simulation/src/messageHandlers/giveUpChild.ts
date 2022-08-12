import { Message, MessageType, StopStatus } from '../message'
import { Node, NodeRole } from '../node'

export function handleGiveUpChild(this: Node, receivedMessage: Message): Message[] {
  const messages: Message[] = []

  if (!this.node) {
    throw new Error(`#${this.id} ${receivedMessage.type} requires the node to be in the tree`)
  }
  if (receivedMessage.content.targetNode === undefined) {
    throw new Error(`#${this.id} ${receivedMessage.type} did not receive the target node`)
  }

  // Drop the child group
  this.node.children = this.node.children.filter(e => !e.members.includes(receivedMessage.content.targetNode!))

  // Check if current aggregate is valid
  const position = this.node.members.indexOf(this.id)
  const aggregates = this.node.children.map(e => this.aggregates[e.members[position]])
  if (aggregates.every(Boolean)) {
    // Send the aggregate of the obtained child, defaulting to empty aggregate
    const aggregate = aggregates.reduce(
      (prev, curr) => ({
        counter: prev.counter + curr.counter,
        data: prev.data + curr.data,
        id: this.aggregationId(aggregates.map(e => e.id)),
      }),
      {
        counter: 0,
        data: 0,
        id: '0',
      }
    )

    if (this.role === NodeRole.Querier) {
      const finalResult = aggregate.data / aggregate.counter
      // TODO: Use a dynamic result
      const errorMargin = 0.0001 // 0.1%, due to numerical precision
      if (finalResult < 50 * (1 - errorMargin) || finalResult > 50 * (1 + errorMargin)) {
        messages.push(new Message(MessageType.StopSimulator, 0, -1, this.id, this.id, { status: StopStatus.BadResult }))
      } else {
        messages.push(
          new Message(MessageType.StopSimulator, 0, -1, this.id, this.id, {
            status: StopStatus.Success,
            contributors: Array(aggregate.counter / this.config.groupSize), // Trick to send the number of contributors
          })
        )
      }
    } else {
      messages.push(
        new Message(MessageType.SendAggregate, this.localTime, 0, this.id, this.node.parents[position], { aggregate })
      )
    }
  }

  return messages
}
