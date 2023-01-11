import NodesManager from '../../manager'
import { Message, StopStatus } from '../../message'

export function handleStopSimulator(this: NodesManager, receivedMessage: Message) {
  const alive = this.nodes[receivedMessage.receiverId].isAlive(receivedMessage.receptionTime)

  // Flushing the message queue
  this.messages = []
  this.status = receivedMessage.content.status!

  switch (this.status) {
    case StopStatus.SimultaneousFailures:
      console.log(
        `#${
          receivedMessage.content.targetGroup?.members[0]
        } did not receive its children from its members. Members = [${receivedMessage.content.targetGroup!.members.map(
          e => `#${e} (${alive}@${this.nodes[e].deathTime})`
        )}]; children = [${receivedMessage.content.targetGroup!.children}]`
      )
      break
    case StopStatus.GroupDead:
      console.log(
        `Group of node [${
          receivedMessage.content.targetGroup!.members
        }]) died at [${receivedMessage.content.targetGroup!.members.map(m => this.nodes[m].deathTime)}]`
      )
    case StopStatus.Success:
      this.finalNumberContributors = receivedMessage.content.contributors?.length || 0
      break
  }
}
