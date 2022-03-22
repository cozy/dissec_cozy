import Node, { NodeRole } from './node'
import { Generator } from './random'
import TreeNode from './treeNode'

export enum MessageType {
  // System
  StopSimulator = "StopSimulator",
  // Contribution
  RequestContribution = "RequestContribution",
  SendContribution = "SendContribution",
  ContributionTimeout = "ContributionTimeout",
  // Synchronization
  ShareContributors = "ShareContributors",
  ConfirmContributors = "ConfirmContributors",
  SendAggregate = "SendAggregate",
  // Failure detection
  RequestHealthChecks = "RequestHealthChecks",
  CheckHealth = "CheckHealth",
  ConfirmHealth = "ConfirmHealth",
  HealthCheckTimeout = "HealthCheckTimeout",
  // Failure handling
  ContinueMulticast = "ContinueMulticast",
  ContactBackup = "ContactBackup",
  BackupResponse = "BackupResponse",
  ConfirmBackup = "ConfirmBackup",
  NotifyGroup = "NotifyGroup",
  SendChildren = "SendChildren",
  RequestData = "RequestData"
}

export interface MessageContent {
  success?: boolean
  parents?: number[]
  share?: number
  contributors?: number[]
  aggregate?: { counter: number; data: number }
  failedNode?: number
  targetGroup?: TreeNode
  remainingBackups?: number[]
  backupIsAvailable?: boolean
  backupList?: number[]
  useAsBackup?: boolean
  role?: NodeRole
  children?: TreeNode[]
}

export class Message {
  id: number
  type: MessageType
  emissionTime: number
  receptionTime: number
  emitterId: number
  receiverId: number
  content: MessageContent
  delivered: boolean

  constructor(
    type: MessageType,
    emissionTime: number,
    receptionTime: number,
    emitterId: number,
    receiverId: number,
    content: MessageContent
  ) {
    this.id = Generator.get()()
    this.type = type
    this.emissionTime = emissionTime
    this.receptionTime = receptionTime
    this.emitterId = emitterId
    this.receiverId = receiverId
    this.content = content
    this.delivered = false
  }

  log(receiver: Node, filter: MessageType[] = []) {
    if (filter.includes(this.type)) return

    const tag = `[@${receiver.localTime}] (${receiver.role}) Node #${receiver.id}`
    const position = receiver.node?.members.indexOf(receiver.id)
    let children: number[] = receiver.role === NodeRole.Querier ?
      receiver.node?.children[0].members :
      (receiver.node?.children.map(e => position ? e.members[position] : undefined).filter(e => e !== undefined) as any)

    switch (receiver.role) {
      case NodeRole.Querier:
        children = receiver.node!.children[0].members
        break
      case NodeRole.LeafAggregator:
        children = receiver.node!.children.flatMap(e => e.members)
        break
      case NodeRole.Backup:
        children = []
        break
      default:
        children = receiver.node!.children.map(e => e.members[position!])
        break
    }

    switch (this.type) {
      case MessageType.RequestContribution:
        console.log(
          `${tag} received a request for contribution`
        )
        break
      case MessageType.SendContribution:
        console.log(
          `${tag} received contribution #${Object.values(receiver.contributions).length + 1} (${this.content.share})`
        )
        break
      case MessageType.ContributionTimeout:
        console.log(
          `${tag} timed out waiting for contributions, received ${Object.values(receiver.contributions).length}`
        )
        break
      case MessageType.ShareContributors:
        console.log(
          `${tag} received contributors from member node #${this.emitterId
          }:\n${this.content.contributors}.`
        )
        break
      case MessageType.ConfirmContributors:
        console.log(
          `${tag} received a confirmation of the final contributors list from member node #${this.emitterId
          }, sending data to parent #${receiver.node!.parents[receiver.node!.members.indexOf(receiver.id)]}`
        )
        break
      case MessageType.SendAggregate:
        console.log(
          `${tag} received an aggregate from child #${this.emitterId}. [${children
            ?.filter(child => Boolean(receiver.aggregates[child]))
            .map(e => "#" + e)
          }] out of [${children.map(e => "#" + e)}]`
        )
        break
      case MessageType.RequestHealthChecks:
        console.log(
          `${tag} is requesting health checks from his children [${children.map(e => "#" + e)}]`
        )
        break
      case MessageType.CheckHealth:
        console.log(
          `${tag} received a health check request from parent node #${this.emitterId}.`
        )
        break
      case MessageType.ConfirmHealth:
        console.log(
          `${tag} received a health confirmation from child node #${this.emitterId
          } ([${Object.keys(receiver.ongoingHealthChecks)}]).`
        )
        break
      case MessageType.HealthCheckTimeout:
        console.log(
          `${tag} timed out health checks. ${Object.keys(receiver.ongoingHealthChecks).length
          } ongoing health checks are unanswered:`
        )
        for (const unansweredHealthCheck of Object.keys(receiver.ongoingHealthChecks)) {
          console.log(
            `\t- Node #${unansweredHealthCheck} did not answer the health check, triggering recovery procedure...`
          )
        }
        break
      case MessageType.ContinueMulticast:
        if (receiver.continueMulticast)
          console.log(
            `${tag} tries to continue multicasting to backups`
          )
        else
          console.log(
            `${tag} does not need top continue multicasting`
          )
        break
      case MessageType.BackupResponse:
        console.log(
          `${tag} received a ${this.content.backupIsAvailable ? 'positive' : 'negative'
          } response from backup #${this.emitterId}`
        )
        break
      case MessageType.ConfirmBackup:
        console.log(
          `${tag} received a ${this.content.useAsBackup ? 'positive' : 'negative'
          } response from the parent #${this.emitterId} to join group [${this.content.targetGroup?.members}] to replace #${this.content.failedNode}`
        )
        break
      case MessageType.NotifyGroup:
        console.log(
          `${tag} has been contacted by the new member #${this.emitterId} to know its children, replacing ${this.content.failedNode} in group [${receiver.node?.members}]`
        )
        break
      case MessageType.SendChildren:
        console.log(
          `${tag} has received its children from node #${this.emitterId} and will become a ${this.content.role}. ${!receiver.node?.children ||
            receiver.node.children.length === 0 ? "They are new children" : "Already known children"
          } ([[${this.content.children?.map(e => e.members).join('], [')}]])`
        )
        break
      case MessageType.RequestData:
        console.log(
          `${tag} has been requested data by backup #${this.emitterId} joining the tree`
        )
        break
    }
  }
}

export default Message
