import { Node, NodeRole } from "../node"
import { Message, MessageType } from "../message"
import { HEALTH_CHECK_PERIOD, MAX_LATENCY } from "../manager"

export function handleRequestHealthChecks(this: Node, receivedMessage: Message): Message[] {
  const messages: Message[] = []

  if (!this.node) throw new Error(`${receivedMessage.type} requires the node to be in the tree`)

  const position = this.node!.members.indexOf(this.id)
  let childrenHaveNotSent: number[] = []

  if (this.role === NodeRole.Querier) {
    // Check the health of all node in the children group who haven't sent data
    const children = this.node.children[0].members
    childrenHaveNotSent = children.filter(child => !this.aggregates[child])
  } else if (this.role === NodeRole.Aggregator) {
    // Check the health of the node in the same position in each child
    const children = this.node.children.map(child => child.members[position])
    childrenHaveNotSent = children.filter(child => !this.aggregates[child])
  }

  for (const child of childrenHaveNotSent) {
    const msg = new Message(
      MessageType.CheckHealth,
      this.localTime,
      0, // Don't specify time to let the manager add the latency
      this.id,
      child,
      {}
    )
    messages.push(msg)
    this.ongoingHealthChecks.push(msg.receiverId)
  }

  // Set a timeout to trigger the recovery procedure for not responding nodes
  messages.push(
    new Message(
      MessageType.HealthCheckTimeout,
      this.localTime,
      this.localTime + 2 * MAX_LATENCY,
      this.id,
      this.id,
      {}
    )
  )

  // Reschedule health checks
  if (!this.finishedWorking) {
    console.log(`Node #${this.id} is rescheduling a health check for child`)
    messages.push(
      new Message(
        MessageType.RequestHealthChecks,
        this.localTime,
        this.localTime + HEALTH_CHECK_PERIOD,
        this.id,
        this.id,
        {}
      )
    )
  }

  return messages
}
