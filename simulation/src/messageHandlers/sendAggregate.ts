import { Node, NodeRole } from "../node"
import { Message, MessageType } from "../message"

export function handleSendAggregate(this: Node, receivedMessage: Message): Message[] {
  const messages: Message[] = []

  if (!this.node) throw new Error(`${receivedMessage.type} requires the node to be in the tree`)
  if (!receivedMessage.content.aggregate) throw new Error('Received an empty aggregate')

  this.aggregates[receivedMessage.emitterId] = receivedMessage.content.aggregate

  if (this.role === NodeRole.Querier) {
    const position = this.node.members.indexOf(this.id)
    const expectedAggregates = this.node.children.map(child => this.aggregates[child.members[position]]).filter(e => !!e)
    if (expectedAggregates.length === this.node.members.length) {
      // Received all shares
      const result = expectedAggregates.reduce((prev, curr) => ({
        counter: prev.counter + curr.counter,
        data: prev.data + curr.data
      }))
      this.finishedWorking = true
      console.log(
        `Final aggregation result: ${result.counter
        } contributions -> ${(result.data / result.counter) *
        expectedAggregates.length}\n\n\n`
      )
      messages.push(new Message(MessageType.StopSimulator, 0, 0, 0, 0, {}))
    }
  } else {
    if (Object.values(this.aggregates).length === this.node.children.length) {
      // Forwarding the result to the parent
      const aggregate = Object.values(this.aggregates).reduce((prev, curr) => ({
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
