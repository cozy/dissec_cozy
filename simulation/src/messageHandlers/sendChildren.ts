import { Node, NodeRole } from "../node"
import { Message, MessageType } from "../message"
import TreeNode from "../treeNode"
import { MAX_LATENCY } from "../manager"

export function handleSendChildren(this: Node, receivedMessage: Message): Message[] {
  const messages: Message[] = []

  if (!this.node) throw new Error(`${receivedMessage.type} requires the node to be in the tree`)
  if (!receivedMessage.content.role) throw new Error("The message did not contain a role")
  if (!receivedMessage.content.backupList) throw new Error("The message did not contain a backup list")
  if (!receivedMessage.content.children) throw new Error("The message did not contain children")
  if (!receivedMessage.content.targetGroup) throw new Error("The message did not contain member version")

  // The node has received its children from its members
  // Fetch data from them if its the first time the backup receives them
  if (this.node.children.length === 0) {
    this.node.children = receivedMessage.content.children.map(child => TreeNode.fromCopy(child, child.id)) // Copy children
    this.role = receivedMessage.content.role
    this.backupList = receivedMessage.content.backupList

    if (this.role === NodeRole.LeafAggregator) {
      if (!receivedMessage.content.contributors) throw new Error("The message did not contain the expected contributors")
      this.expectedContributors = receivedMessage.content.contributors

      // Query all contributors
      // Resume the aggregation by asking for data and checking health
      for (const contributor of this.expectedContributors) {
        messages.push(
          new Message(
            MessageType.RequestData,
            this.localTime,
            0, // ASAP
            this.id,
            contributor,
            { parents: this.node.members }
          )
        )
      }

      // TODO: This should not wait for a timeout since it knows how many contributions are expected
      // Wait for all contributions
      messages.push(
        new Message(
          MessageType.ContributionTimeout,
          this.localTime,
          this.localTime + 2 * MAX_LATENCY,
          this.id,
          this.id,
          {}
        )
      )
    } else {
      const position = this.node.members.indexOf(this.id)
      // Resume the aggregation by asking for data and checking health
      for (const child of this.node.children) {
        // Contact the matching member in each child to update new parents and send data
        messages.push(
          new Message(
            MessageType.RequestData,
            this.localTime,
            0, // ASAP
            this.id,
            child.members[position],
            { parents: this.node.members }
          )
        )
      }

      // Start monitoring children's health
      messages.push(
        new Message(
          MessageType.RequestHealthChecks,
          this.localTime,
          this.localTime + 2 * MAX_LATENCY,
          this.id,
          this.id,
          {}
        )
      )
    }
  }

  return messages
}
