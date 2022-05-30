import { Message, MessageType, StopStatus } from '../message'
import { Node, NodeRole } from '../node'

export function handleSendAggregate(this: Node, receivedMessage: Message): Message[] {
  const messages: Message[] = []

  if (!this.node) {
    throw new Error(`${this.id} is not in the tree`)
  }
  if (!receivedMessage.content.aggregate) {
    throw new Error('Received an empty aggregate')
  }

  // Cryptographic verification have been executed during the tree setup except for backups

  if (this.role === NodeRole.Querier) {
    this.aggregates[receivedMessage.emitterId] = receivedMessage.content.aggregate

    // Expecting one aggregate from each member of the child group
    const expectedAggregates = this.node.children[0].members.map(child => this.aggregates[child]).filter(Boolean)

    // Compute unique IDs
    const uniqueIds: string[] = []
    expectedAggregates.forEach(e => {
      if (!uniqueIds.includes(e.id)) uniqueIds.push(e.id)
    })

    if (expectedAggregates.length === this.node.members.length && uniqueIds.length === 1) {
      // Received all shares
      this.finishedWorking = true

      const result = expectedAggregates.reduce((prev, curr) => ({
        counter: prev.counter + curr.counter,
        data: prev.data + curr.data,
        id: uniqueIds[0],
      }))
      const finalResult = result.data / result.counter
      // TODO: Use a dynamic result
      const errorMargin = 0.0001 // 0.1%, due to numerical precision
      if (finalResult < 50 * (1 - errorMargin) || finalResult > 50 * (1 + errorMargin)) {
        messages.push(new Message(MessageType.StopSimulator, 0, -1, this.id, this.id, { status: StopStatus.BadResult }))
      } else {
        messages.push(new Message(MessageType.StopSimulator, 0, -1, this.id, this.id, { status: StopStatus.Success }))
      }
    }
  } else {
    const position = this.node.members.indexOf(this.id)
    // This is equal to the last sent aggregation ID
    // If none was ever sent, it changes each time a new aggregate is received
    // It prevents sending the same aggregate twice
    const oldAggregationId = this.aggregationId(
      this.node.children.map(e => this.aggregates[e.members[position]]?.id || '')
    )

    this.aggregates[receivedMessage.emitterId] = receivedMessage.content.aggregate
    const aggregates = this.node.children.map(e => this.aggregates[e.members[position]])
    const newAggregationId = this.aggregationId(aggregates.map(e => e?.id || ''))

    if (
      aggregates.every(Boolean) &&
      newAggregationId !== oldAggregationId &&
      this.lastReceivedAggregateId !== newAggregationId
    ) {
      // Forwarding the new aggregate to the parent if it was never sent before
      const aggregate = aggregates.reduce((prev, curr) => ({
        counter: prev.counter + curr.counter,
        data: prev.data + curr.data,
        id: this.aggregationId(aggregates.map(e => e.id)),
      }))

      // Stop regularly checking children's health
      this.finishedWorking = true

      this.lastSentAggregateId = aggregate.id
      messages.push(
        new Message(
          MessageType.SendAggregate,
          this.localTime,
          0, // Don't specify time to let the manager add the latency
          this.id,
          this.node.parents[this.node.members.indexOf(this.id)],
          {
            aggregate,
          }
        )
      )
    }
  }

  return messages
}
