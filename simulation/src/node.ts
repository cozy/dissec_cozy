import { Message, MessageType } from './message'
import { Generator } from './random'
import TreeNode from './treeNode'

class Node {
  id: number
  node: TreeNode
  localTime: number
  alive: boolean

  constructor(node: TreeNode) {
    this.id = node.id
    this.node = node
    this.localTime = 0
    this.alive = true
  }

  emitMessage(unsentMessage: Message): Message[] {
    const generator = Generator.get()
    const messages: Message[] = []

    switch (unsentMessage.type) {
      case MessageType.RequestContribution:
        // When requesting contributions, the node in the aggregating group with the smallest ID broadcast to its children
        console.log(
          `Node #${this.id} is requesting contributions to its children`
        )
        for (const child of this.node.children) {
          for (const member of child.members) {
            messages.push(
              new Message(
                generator(),
                unsentMessage.type,
                unsentMessage.emissionTime,
                unsentMessage.receptionTime,
                unsentMessage.emitterId,
                member,
                unsentMessage.content
              )
            )
          }
        }
        // The deadline accounts for contacting all children, getting answers to members, then transmitting the list to the leader (3 hops)
        messages.push(
          new Message(
            generator(),
            unsentMessage.type,
            unsentMessage.emissionTime,
            unsentMessage.receptionTime,
            unsentMessage.emitterId,
            unsentMessage.receiverId,
            unsentMessage.content
          )
        )
        break
      default:
        throw new Error('Emitting unknown message type')
    }

    return messages
  }

  receiveMessage(receivedMessage: Message): Message[] {
    const messages: Message[] = []

    switch (receivedMessage.type) {
      case MessageType.RequestContribution:
        break
      default:
        throw new Error('Receiving unknown message type')
    }

    return messages
  }
}

export default Node
