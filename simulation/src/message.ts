import { arrayEquals } from './helpers'
import Node, { NodeRole } from './node'
import { Generator } from './random'
import TreeNode from './treeNode'

export enum MessageType {
  // System
  StopSimulator = 'STOP',
  // Contribution
  RequestContribution = 'ReqContrib',
  ContributorPing = 'ContribPing',
  PingTimeout = 'PingTO',
  PrepareContribution = 'PrepareContrib',
  SendContribution = 'SendContrib',
  ContributionTimeout = 'ContribTO',
  // Synchronization
  ConfirmContributors = 'ConfContrib',
  SynchronizationTimeout = 'SynchroTO',
  SendAggregate = 'SendAgg',
  // Failure detection
  Failing = 'Fail',
  RequestHealthChecks = 'ReqHC',
  CheckHealth = 'HC',
  ConfirmHealth = 'ConfH',
  HealthCheckTimeout = 'HCTO',
  // Failure handling
  ContinueMulticast = 'ContMCast',
  ContactBackup = 'ContactBU',
  BackupResponse = 'BUResponse',
  ConfirmBackup = 'ConfBU',
  NotifyGroup = 'NotifGroup',
  NotifyGroupTimeout = 'NotifGroupTO',
  ContributorsPolling = 'ContributorsPolling',
  SendChildren = 'SendChildren',
  RequestData = 'ReqData',
  GiveUpChild = 'GiveUp',
}

export enum StopStatus {
  Unfinished = 'Unfinished',
  Success = 'Success',
  GroupDead = 'GroupDead',
  SimultaneousFailures = 'SimulFails',
  ExceededDeadline = 'Deadline',
  BadResult = 'BadResult',
  AllContributorsDead = 'ContribDead',
  OutOfBackup = '0Backup',
}

export interface Aggregate {
  counter: number
  data: number
  id: string
}

export interface MessageContent {
  status?: StopStatus
  targetNode?: number
  parents?: number[]
  members?: number[]
  share?: number
  contributors?: number[]
  aggregate?: Aggregate
  parentLastReceivedAggregateId?: string
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
  delivered: boolean = false
  work: number = 0

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
  }

  log(receiver: Node, filter: MessageType[] = []) {
    if (filter.includes(this.type)) return

    const tag = `[@${receiver.localTime}] (${receiver.role}) Node #${receiver.id}`
    const position = receiver.node?.members.indexOf(receiver.id)
    let children: number[] =
      receiver.role === NodeRole.Querier
        ? receiver.node?.children[0].members
        : (receiver.node?.children
            .map(e => (position ? e.members[position] : undefined))
            .filter(e => e !== undefined) as any)

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
        console.log(`${tag} received a request for contribution`)
        break
      case MessageType.PrepareContribution:
        console.log(`${tag} is processing share to send to node #${this.content.targetNode}`)
        break
      case MessageType.SendContribution:
        console.log(
          `${tag} received contribution #${Object.values(receiver.contributions).length + 1} (${
            this.content.share
          }) from #${this.emitterId}`
        )
        break
      case MessageType.ContributionTimeout:
        console.log(
          `${tag} timed out waiting for contributions, received ${
            Object.values(receiver.contributions).length
          } contributions from [${receiver.contributorsList[receiver.id]
            ?.filter(e => receiver.contributions[e])
            .slice()
            .sort()}], sending to others [${receiver.node?.members.filter(e => e !== receiver.id).map(e => '#' + e)}]`
        )
        break
      case MessageType.ContributorPing:
        console.log(`${tag} received a contribution ping from node #${this.emitterId}`)
        break
      case MessageType.PingTimeout:
        console.log(
          `${tag} timed out waiting for contribution pings, found ${receiver.pingList.length}: [${receiver.pingList
            .slice()
            .sort()
            .map(e => '#' + e)}]`
        )
        break
      case MessageType.ConfirmContributors:
        console.log(
          `${tag} received a${
            arrayEquals(receiver.contributorsList[receiver.id] || [], this.content.contributors || [])
              ? ''
              : ' different'
          } confirmed list of ${this.content.contributors?.length} contributors from node #${this.emitterId}, ${
            receiver.contributorsList[receiver.id]?.every(e => receiver.contributions[e]) ? '' : 'not '
          }sending data to parent #${receiver.node!.parents[receiver.node!.members.indexOf(receiver.id)]}. ${
            this.content.contributors
              ? `new id=${receiver.aggregationId(this.content.contributors.map(String))}`
              : 'Did not receive contributors'
          }`
        )
        break
      case MessageType.SynchronizationTimeout:
        const contributors = receiver.contributorsList[receiver.id] || []
        console.log(
          `${tag} timed out waiting for confirmations of contributors and is missing ${
            contributors.length - contributors.map(e => receiver.contributions[e]).filter(Boolean).length
          } contributors`
        )
        break
      case MessageType.SendAggregate:
        console.log(
          `${tag} received an aggregate from child #${this.emitterId} (ID=${this.content.aggregate!.id}). [${children
            ?.filter(child => Boolean(receiver.aggregates[child]))
            .map(e => '#' + e)}] out of [${children.map(e => `#${e}(${receiver.aggregates[e]?.id || '??'})`)}]`
        )
        break
      case MessageType.Failing:
        console.log(`${tag} is failing`)
        break
      case MessageType.RequestHealthChecks:
        console.log(
          `${tag} is requesting health checks from his children [${children.map(e => '#' + e)}]. ${
            receiver.finishedWorking ? 'Not rescheduling' : 'Rescheduling'
          }`
        )
        break
      case MessageType.CheckHealth:
        console.log(`${tag} received a health check request from parent node #${this.emitterId}.`)
        break
      case MessageType.ConfirmHealth:
        console.log(
          `${tag} received a health confirmation from child node #${this.emitterId} ([${Object.keys(
            receiver.ongoingHealthChecks
          )}]). ${
            receiver.role !== NodeRole.Querier &&
            this.content.members &&
            !arrayEquals(
              receiver.node!.children.find(e => e.members.includes(this.emitterId))!.members,
              this.content.members!
            )
              ? ` Child updated its members: [${
                  receiver.node!.children.find(e => e.members.includes(this.emitterId))!.members
                }] -> [${this.content.members}]`
              : ''
          }`
        )
        break
      case MessageType.HealthCheckTimeout:
        console.log(
          `${tag} timed out health checks. ${
            Object.keys(receiver.ongoingHealthChecks).length
          } ongoing health checks are unanswered:`
        )
        for (const unansweredHealthCheck of Object.keys(receiver.ongoingHealthChecks)) {
          console.log(
            `\t- Node #${unansweredHealthCheck} did not answer the health check, triggering recovery procedure...`
          )
        }
        break
      case MessageType.ContinueMulticast:
        if (receiver.continueMulticast) console.log(`${tag} tries to continue multicasting to backups`)
        else console.log(`${tag} does not need top continue multicasting`)
        break
      case MessageType.ContactBackup:
        console.log(`${tag} received a request from node #${this.emitterId} to replace #${this.content.failedNode}`)
        break
      case MessageType.BackupResponse:
        console.log(
          `${tag} received a ${this.content.backupIsAvailable ? 'positive' : 'negative'} response from backup #${
            this.emitterId
          } to replace #${this.content.failedNode}`
        )
        break
      case MessageType.ConfirmBackup:
        console.log(
          `${tag} received a ${this.content.useAsBackup ? 'positive' : 'negative'} response from the parent #${
            this.emitterId
          } to join group [${this.content.targetGroup?.members.map(e => '#' + e)}] to replace #${
            this.content.failedNode
          }`
        )
        break
      case MessageType.NotifyGroup:
        console.log(
          `${tag} has been contacted by the new member #${this.emitterId} to know its children, replacing #${
            this.content.failedNode
          } in group [${this.content.targetGroup?.members.map(e => '#' + e)}]${
            receiver.contributorsList[receiver.id] || receiver.node?.children.length
              ? '.'
              : ', but does not know child yet.'
          }`
        )
        break
      case MessageType.NotifyGroupTimeout:
        console.log(
          `${tag} has timed out on the group notification. ${
            receiver.node?.children.length
              ? `New children are [${receiver.node?.children.map(e => '#' + e.members[position!])}]`
              : 'No known children'
          }`
        )
        break
      case MessageType.ContributorsPolling:
        console.log(
          `${tag} has timed out on the group notification. New children are [${receiver.node?.children.map(
            e => e.members[position!]
          )}] ${!receiver.node?.children.length ? 'No known children' : 'Ignored'}`
        )
        break
      case MessageType.SendChildren:
        console.log(
          `${tag} received its children from node #${this.emitterId}: [${this.content.children?.map(
            e => '#' + e.members
          )}]`
        )
        break
      case MessageType.RequestData:
        console.log(`${tag} has been requested data by backup #${this.emitterId} joining the tree`)
        break
      case MessageType.GiveUpChild:
        console.log(`${tag} has been told to give up child ${this.content.targetNode} by member ${this.emitterId}`)
        break
    }
  }
}

export default Message
