import { Node, NodeRole } from "../node"
import { Message, MessageType } from "../message"

export function handleSendAggregate(this: Node, receivedMessage: Message): Message[] {
  const messages: Message[] = []

  if (!this.node) throw new Error(`${receivedMessage.type} requires the node to be in the tree`)
  if (!receivedMessage.content.aggregate) throw new Error('Received an empty aggregate')

  this.aggregates[receivedMessage.emitterId] = receivedMessage.content.aggregate

  if (this.role === NodeRole.Querier) {
    // Expecting one aggregate from each member of the child group
    const expectedAggregates = this.node.children[0].members.map(child => this.aggregates[child]).filter(Boolean)
    console.log(expectedAggregates, this.node.members.length, this.node.children[0].members.map(child => this.aggregates[child]))
    if (expectedAggregates.length === this.node.members.length) {
      // Received all shares
      const result = expectedAggregates.reduce((prev, curr) => ({
        counter: prev.counter + curr.counter,
        data: prev.data + curr.data
      }))
      this.finishedWorking = true

      console.log(
        `Final aggregation result: ${result.counter
        } contributions -> ${result.data / result.counter}\n\n\n`
      )
      messages.push(new Message(MessageType.StopSimulator, this.localTime, this.localTime, 0, 0, {}))
    }
  } else {
    const position = this.node.members.indexOf(this.id)
    if (this.node.children.map(e => this.aggregates[e.members[position]]).every(Boolean)) {
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
