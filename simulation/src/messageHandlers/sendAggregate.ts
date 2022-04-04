import { Message, MessageType, StopStatus } from '../message'
import { Node, NodeRole } from '../node'

export function handleSendAggregate(this: Node, receivedMessage: Message): Message[] {
  const messages: Message[] = []

  if (!this.node) {
    throw new Error(`${receivedMessage.type} requires the node to be in the tree`)
  }
  if (!receivedMessage.content.aggregate) {
    throw new Error('Received an empty aggregate')
  }

  this.aggregates[receivedMessage.emitterId] = receivedMessage.content.aggregate

  if (this.role === NodeRole.Querier) {
    // Expecting one aggregate from each member of the child group
    const expectedAggregates = this.node.children[0].members.map(child => this.aggregates[child]).filter(Boolean)
    if (expectedAggregates.length === this.node.members.length) {
      // Received all shares
      this.finishedWorking = true

      // const result = expectedAggregates.reduce((prev, curr) => ({
      //   counter: prev.counter + curr.counter,
      //   data: prev.data + curr.data
      // }))
      // console.log(
      //   `Final aggregation result: ${result.counter
      //   } contributions -> ${result.data / result.counter}\n\n\n`
      // )
      messages.push(new Message(MessageType.StopSimulator, 0, -1, this.id, this.id, { status: StopStatus.Success }))
    }
  } else {
    const position = this.node.members.indexOf(this.id)
    const aggregates = this.node.children.map(e => this.aggregates[e.members[position]])
    if (aggregates.every(Boolean) && !this.finishedWorking) {
      // Forwarding the result to the parent
      const aggregate = aggregates.reduce((prev, curr) => ({
        counter: prev.counter + curr.counter,
        data: prev.data + curr.data
      }))

      // Stop regularly checking children's health
      this.finishedWorking = true

      messages.push(
        new Message(
          MessageType.SendAggregate,
          this.localTime,
          0, // Don't specify time to let the manager add the latency
          this.id,
          this.node.parents[this.node.members.indexOf(this.id)],
          {
            aggregate
          }
        )
      )
    }
  }

  return messages
}
