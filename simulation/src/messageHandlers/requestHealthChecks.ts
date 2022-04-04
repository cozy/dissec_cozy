import { HEALTH_CHECK_PERIOD, MAX_LATENCY } from '../manager'
import { Message, MessageType } from '../message'
import { Node, NodeRole } from '../node'

export function handleRequestHealthChecks(this: Node, receivedMessage: Message): Message[] {
  const messages: Message[] = []

  if (!this.node) {
    throw new Error(`${receivedMessage.type} requires the node to be in the tree`)
  }

  const position = this.node!.members.indexOf(this.id)
  let children: number[] = []

  if (this.role === NodeRole.Querier) {
    // Check the health of all node in the children group who haven't sent data
    // Do not request from nodes we're already trying to replace to avoid conflicting requests
    children = this.node.children[0].members.filter(e => !this.lookingForBackup[e])
  } else if (this.role === NodeRole.Aggregator) {
    // Check the health of the node in the same position in each child
    // Do not request from nodes we're already trying to replace to avoid conflicting requests
    children = this.node.children.map(child => child.members[position]).filter(e => !this.lookingForBackup[e])
  }

  for (const child of children) {
    const msg = new Message(
      MessageType.CheckHealth,
      this.localTime,
      0, // Don't specify time to let the manager add the latency
      this.id,
      child,
      {}
    )
    messages.push(msg)
    this.ongoingHealthChecks[msg.receiverId] = true
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

  // Always reschedule health checks to keep child groups fresh
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

  return messages
}
