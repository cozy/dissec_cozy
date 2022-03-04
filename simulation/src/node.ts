import {
  AVERAGE_COMPUTE,
  AVERAGE_CRYPTO,
  HEALTH_CHECK_PERIOD,
  MAX_LATENCY,
  MULTICAST_SIZE
} from './manager'
import { Message, MessageType } from './message'
import { createGenerator, Generator } from './random'
import TreeNode from './treeNode'

const BASE_NOISE = 10000000

export const arrayEquals = (a: number[], b: number[]): boolean => {
  return JSON.stringify(a.sort()) === JSON.stringify(b.sort())
}

export enum NodeRole {
  Querier = "Querier",
  Aggregator = "Aggregator",
  LeafAggregator = "LeafAggregator",
  Contributor = "Contributor",
  Backup = "Backup"
}

class Node {
  id: number
  node?: TreeNode
  localTime: number
  alive: boolean
  deathTime: number
  role: NodeRole
  ongoingHealthChecks: number[]
  finishedWorking: boolean
  backupList: number[]
  continueMulticast: boolean
  contactedAsABackup: boolean
  shares: number[]
  contributorsList: number[][]
  contributions: { [contributor: string]: number }
  expectedContributors: number[]
  aggregates: { [nodeId: number]: { counter: number; data: number } }

  constructor({ node, id }: { node?: TreeNode, id?: number }) {
    if (!node && !id) return //throw new Error("Initializing a node without id")

    this.id = (node ? node.id : id)!
    this.node = node
    this.localTime = 0
    this.alive = true
    this.deathTime = 0
    this.role = NodeRole.Aggregator
    this.ongoingHealthChecks = []
    this.finishedWorking = false
    this.backupList = []
    this.continueMulticast = false
    this.contactedAsABackup = false
    this.contributorsList = [[]]
    this.contributions = {}
    this.expectedContributors = []
    this.aggregates = {}
  }

  receiveMessage(receivedMessage: Message): Message[] {
    const messages: Message[] = []
    const position = this.node?.members.indexOf(this.id)
    const generator = Generator.get()

    this.localTime = Math.max(this.localTime, receivedMessage.receptionTime)

    const nodeOfInterest: number[] = [2, 5, 20, 35, 50]
    if (nodeOfInterest.includes(this.id) || nodeOfInterest.includes(receivedMessage.emitterId) || nodeOfInterest.length === 0)
      receivedMessage.log(this, [MessageType.CheckHealth, MessageType.ConfirmHealth, MessageType.HealthCheckTimeout])

    switch (receivedMessage.type) {
      case MessageType.RequestContribution:
        if (!this.node) throw new Error(`${receivedMessage.type} requires the node to be in the tree`)

        // TODO: Set contributors during initialization
        this.role = NodeRole.Contributor

        // Prepare shares
        this.localTime += AVERAGE_COMPUTE
        // TODO: Better value, not always 50
        this.shares = Array(this.node.members.length).fill(0)
        let accumulator = 0
        for (let i = 0; i < this.node.members.length - 1; i++) {
          this.shares[i] = BASE_NOISE * generator()
          accumulator += this.shares[i]
        }
        this.shares[this.shares.length - 1] = 50 - accumulator

        for (const parent of receivedMessage.content.parents || []) {
          // Open a secure channel
          this.localTime += AVERAGE_CRYPTO

          // Send data to parent
          messages.push(
            new Message(
              MessageType.SendContribution,
              this.localTime,
              0, // Don't specify time to let the manager add the latency
              this.id,
              parent,
              { share: this.shares[this.node.parents.indexOf(parent)] }
            )
          )
        }
        break
      case MessageType.SendContribution:
        if (!this.node) throw new Error(`${receivedMessage.type} requires the node to be in the tree`)
        if (!receivedMessage.content.share) throw new Error('Received a contribution without a share')

        this.contributorsList[0].push(receivedMessage.emitterId) // The first item is the local list
        this.contributions[receivedMessage.emitterId] = receivedMessage.content.share

        if (arrayEquals(this.expectedContributors, this.contributorsList[0])) {
          // The node received all expected contributions and can continue the protocole
          // No need to tell the members because they have the same contributors
          console.log("received all contributions, sending to", this.node.parents[this.node.members.indexOf(this.id)])
          messages.push(
            new Message(
              MessageType.SendAggregate,
              this.localTime,
              0, // Don't specify time to let the manager add the latency
              this.id,
              this.node.parents[this.node.members.indexOf(this.id)],
              {
                aggregate: {
                  counter: this.contributorsList[0].length,
                  data: Object.values(this.contributions).reduce(
                    (prev, curr) => prev + curr
                  )
                }
              }
            )
          )
        }
        break
      case MessageType.ContributionTimeout:
        if (!this.node) throw new Error(`${receivedMessage.type} requires the node to be in the tree`)

        if (this.expectedContributors.length !== 0 && arrayEquals(this.expectedContributors, this.contributorsList[0])) {
          // No need to synchronize because all contributors answered
          break
        }

        if (this.id === this.node.members[0]) {
          // The leader aggregates the received contributors lists and confirms them to the group
          const finalContributors = []
          for (const contributor of this.contributorsList[0]) {
            // Checking that a given contributor is in every contributors lists
            if (
              this.contributorsList
                .map(list => list.includes(contributor))
                .every(val => val)
            ) {
              finalContributors.push(contributor)
            }
          }
          this.contributorsList[0] = finalContributors

          for (const member of this.node.members.filter(e => e !== this.id)) {
            messages.push(
              new Message(
                MessageType.ConfirmContributors,
                this.localTime,
                0, // Don't specify time to let the manager add the latency
                this.id,
                member,
                { contributors: finalContributors }
              )
            )
          }

          messages.push(
            new Message(
              MessageType.SendAggregate,
              this.localTime,
              0, // Don't specify time to let the manager add the latency
              this.id,
              this.node.parents[this.node.members.indexOf(this.id)],
              {
                aggregate: {
                  counter: this.contributorsList[0].length,
                  data: Object.values(this.contributions).reduce(
                    (prev, curr) => prev + curr
                  )
                }
              }
            )
          )
        } else {
          // Group members send their contributors list to the first member
          messages.push(
            new Message(
              MessageType.ShareContributors,
              this.localTime,
              0, // Don't specify time to let the manager add the latency
              this.id,
              this.node.members[0],
              { contributors: this.contributorsList[0] }
            )
          )

          // Also send themselves a message to confirm contributors even if the first member is down
          messages.push(
            new Message(
              MessageType.ConfirmContributors,
              this.localTime,
              this.localTime + 2 * MAX_LATENCY, // wait for a back and forth with the first member
              this.id,
              this.id,
              { contributors: this.contributorsList[0] }
            )
          )
        }
        break
      case MessageType.ShareContributors:
        if (
          !receivedMessage.content.contributors ||
          receivedMessage.content.contributors.length === 0
        )
          throw new Error(
            'Received an empty contributors list, the protocol should stop'
          )

        // TODO: Receiving enough contributors list should trigger the timeout
        this.contributorsList.push(receivedMessage.content.contributors)
        break
      case MessageType.ConfirmContributors:
        if (!this.node) throw new Error(`${receivedMessage.type} requires the node to be in the tree`)
        if (
          !receivedMessage.content.contributors ||
          receivedMessage.content.contributors.length === 0
        )
          throw new Error(
            'Received an empty contributors list, the protocol should stop'
          )

        this.contributorsList[0] = receivedMessage.content.contributors

        messages.push(
          new Message(
            MessageType.SendAggregate,
            this.localTime,
            0, // Don't specify time to let the manager add the latency
            this.id,
            this.node.parents[this.node.members.indexOf(this.id)],
            {
              aggregate: {
                counter: this.contributorsList[0].length,
                data: Object.values(this.contributions).reduce(
                  (prev, curr) => prev + curr,
                  0
                )
              }
            }
          )
        )
        break
      case MessageType.SendAggregate:
        if (!this.node) throw new Error(`${receivedMessage.type} requires the node to be in the tree`)
        if (!receivedMessage.content.aggregate) throw new Error('Received an empty aggregate')

        this.aggregates[receivedMessage.emitterId] = receivedMessage.content.aggregate

        if (this.role === NodeRole.Querier) {
          if (Object.values(this.aggregates).length === this.node.members.length) {
            // Received all shares
            const result = Object.values(this.aggregates).reduce((prev, curr) => ({
              counter: prev.counter + curr.counter,
              data: prev.data + curr.data
            }))
            this.finishedWorking = true
            console.log(
              `Final aggregation result: ${result.counter
              } contributions -> ${(result.data / result.counter) *
              Object.values(this.aggregates).length}\n\n\n`
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
        break
      case MessageType.RequestHealthChecks:
        if (!this.node) throw new Error(`${receivedMessage.type} requires the node to be in the tree`)

        if (this.role === NodeRole.Querier) {
          // Check the health of all node in the children group who haven't sent data
          const childrenWhoSent = Object.entries(this.aggregates).map(Number)
          const childrenHaveNotSent = this.node.children[0].members.filter(e => !childrenWhoSent.includes(e))
          for (const member of childrenHaveNotSent) {
            const msg = new Message(
              MessageType.CheckHealth,
              this.localTime,
              0, // Don't specify time to let the manager add the latency
              this.id,
              member,
              {}
            )
            messages.push(msg)
            this.ongoingHealthChecks.push(msg.receiverId)
          }
        } else if (this.role === NodeRole.Aggregator) {
          // Check the health of the node in the same position in each child
          const childrenWhoSent = Object.entries(this.aggregates).map(Number)
          const childrenHaveNotSent = this.node.children.map(e => e.members[position!]).filter(e => !childrenWhoSent.includes(e))
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
        break
      case MessageType.CheckHealth:
        messages.push(
          new Message(
            MessageType.ConfirmHealth,
            this.localTime,
            0, // Don't specify time to let the manager add the latency
            this.id,
            receivedMessage.emitterId,
            {}
          )
        )
        break
      case MessageType.ConfirmHealth:
        this.ongoingHealthChecks.splice(this.ongoingHealthChecks.indexOf(receivedMessage.emitterId), 1)
        break
      case MessageType.HealthCheckTimeout:
        if (!this.node) throw new Error(`${receivedMessage.type} requires the node to be in the tree`)

        for (const unansweredHealthCheck of this.ongoingHealthChecks) {
          // Multicasting to a group of the backup list
          const sorterGenerator = createGenerator(this.id.toString())
          const multicastTargets = this.backupList
            .sort(() => sorterGenerator() - 0.5)
            .slice(0, MULTICAST_SIZE)
          for (const backup of multicastTargets) {
            const targetGroup = this.node.children.filter(e =>
              e.members.includes(unansweredHealthCheck)
            )[0]
            if (!targetGroup) {
              throw new Error(`The failed node (#${unansweredHealthCheck}) is not one of the child (${this.node.children}) of this node...`)
            }
            messages.push(
              new Message(
                MessageType.ContactBackup,
                this.localTime,
                0, // ASAP
                this.id,
                backup,
                {
                  failedNode: unansweredHealthCheck,
                  targetGroup
                }
              )
            )
          }

          const remainingBackups = this.backupList.filter(e =>
            !multicastTargets.includes(e)
          )
          if (remainingBackups.length > 0) {
            // Reschedule a multicast if there are other backups available and the previously contacted ones didn't answer
            this.continueMulticast = true
            messages.push(
              new Message(
                MessageType.ContinueMulticast,
                this.localTime,
                this.localTime + 2 * MAX_LATENCY,
                this.id,
                this.id,
                {
                  remainingBackups
                }
              )
            )
          } else {
            throw new Error("Ran out of backups...")
          }
        }

        this.ongoingHealthChecks = [] // All children have been handled
        break
      case MessageType.ContinueMulticast:
        // TODO: Implement other rounds of multicasting
        break
      case MessageType.ContactBackup:
        if (this.contactedAsABackup || this.role !== NodeRole.Backup) {
          messages.push(
            new Message(
              MessageType.BackupResponse,
              this.localTime,
              0, // ASAP
              this.id,
              receivedMessage.emitterId,
              {
                backupIsAvailable: false
              }
            )
          )
        } else {
          // The backup is available
          this.contactedAsABackup = true
          messages.push(
            new Message(
              MessageType.BackupResponse,
              this.localTime,
              0, // ASAP
              this.id,
              receivedMessage.emitterId,
              {
                backupIsAvailable: true,
                failedNode: receivedMessage.content.failedNode,
                targetGroup: receivedMessage.content.targetGroup
              }
            )
          )

          // TODO: Schedule a timeout to allow this node to be contacted as a backup again if the node who contacted it fails before telling it it's not used as a backup

          // Start querying members
        }
        break
      case MessageType.BackupResponse:
        if (!this.node) throw new Error(`${receivedMessage.type} requires the node to be in the tree`)

        if (receivedMessage.content.backupIsAvailable && this.continueMulticast) {
          // The parent received a response and is still looking for a backup
          // Accept this one, reject future ones
          this.continueMulticast = false

          const child = this.node.children.filter(e =>
            e.members.includes(receivedMessage.content.failedNode!)
          )[0] // The group that the backup will join
          const failedPosition = child.members.indexOf(
            receivedMessage.content.failedNode!
          )

          // Update child group
          child.members[failedPosition] = receivedMessage.emitterId
          child.parents = this.node.members!

          // The backup needs to receive a confirmation before continue the protocole
          messages.push(
            new Message(
              MessageType.ConfirmBackup,
              this.localTime,
              0, // ASAP
              this.id,
              receivedMessage.emitterId,
              {
                useAsBackup: true,
                targetGroup: child
              }
            )
          )
        } else {
          // Tell the backup it's not needed
          messages.push(
            new Message(
              MessageType.ConfirmBackup,
              this.localTime,
              0, // ASAP
              this.id,
              receivedMessage.emitterId,
              {
                useAsBackup: false
              }
            )
          )
        }
        break
      case MessageType.ConfirmBackup:
        // The node received a confirmation from one of the parent that contacted it
        if (receivedMessage.content.useAsBackup && this.role === NodeRole.Backup) {
          // The node is still available and the parent wants it as a child
          this.node = TreeNode.fromCopy(receivedMessage.content.targetGroup!, this.id)
          this.node.children = [] // The backup receives children later
          this.role = NodeRole.Aggregator // This is temporary, to prevent being reassigned as backup

          // Contact its members to know the children
          for (const member of this.node!.members.filter(m => m !== this.id)) {
            messages.push(
              new Message(
                MessageType.NotifyGroup,
                this.localTime,
                0, // ASAP
                this.id,
                member,
                {
                  newMembers: this.node?.members // Send an update of the members
                }
              )
            )
          }
        } else {
          this.contactedAsABackup = false
        }
        break
      case MessageType.NotifyGroup:
        // The node has been notified by a backup that it is joining the group
        this.node!.members = receivedMessage.content.newMembers!
        messages.push(
          new Message(
            MessageType.SendChildren,
            this.localTime,
            0, // ASAP
            this.id,
            receivedMessage.emitterId,
            {
              children: this.node?.children,
              role: this.role,
              backupList: this.backupList,
              contributors: this.contributorsList[0]
            }
          )
        )
        break
      case MessageType.SendChildren:
        // The node has received its children from its members
        // Fetch data from them if its the first time the backup receives them
        if (!this.node?.children || this.node.children.length === 0) {
          this.node!.children = receivedMessage.content.children!.map(e => TreeNode.fromCopy(e, e.id)) // Copy children
          this.role = receivedMessage.content.role!
          this.backupList = receivedMessage.content.backupList!
          this.expectedContributors = receivedMessage.content.contributors || []

          if (this.role === NodeRole.LeafAggregator) {
            // Query all contributors
            // Resume the aggregation by asking for data and checking health
            for (const child of this.node!.children) {
              // TODO: Children should not be in the tree
              for (const member of child.members) {
                messages.push(
                  new Message(
                    MessageType.RequestData,
                    this.localTime,
                    0, // ASAP
                    this.id,
                    member,
                    { parents: this.node!.members }
                  )
                )
              }
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
            // Resume the aggregation by asking for data and checking health
            for (const child of this.node!.children) {
              // Contact the matching member in each child to update new parents and send data
              messages.push(
                new Message(
                  MessageType.RequestData,
                  this.localTime,
                  0, // ASAP
                  this.id,
                  child.members[position!],
                  { parents: this.node!.members }
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
        break
      case MessageType.RequestData:
        // The child updates his parents
        this.node!.parents = receivedMessage.content.parents!
        if (this.role === NodeRole.Contributor) {
          messages.push(
            new Message(
              MessageType.SendContribution,
              this.localTime,
              0, // ASAP
              this.id,
              receivedMessage.emitterId,
              { share: this.shares[this.node!.parents.indexOf(receivedMessage.emitterId)] }
            )
          )
        } else if (this.role === NodeRole.LeafAggregator) {
          messages.push(
            new Message(
              MessageType.SendAggregate,
              this.localTime,
              0, // ASAP
              this.id,
              receivedMessage.emitterId,
              {
                aggregate: {
                  counter: this.contributorsList[0].length,
                  data: Object.values(this.contributions).reduce(
                    (prev, curr) => prev + curr
                  )
                }
              }
            )
          )
        } else {
          messages.push(
            new Message(
              MessageType.SendAggregate,
              this.localTime,
              0, // ASAP
              this.id,
              receivedMessage.emitterId,
              {
                aggregate: Object.values(this.aggregates).reduce((prev, curr) => ({
                  counter: prev.counter + curr.counter,
                  data: prev.data + curr.data
                }))
              }
            )
          )
        }
        break
      default:
        throw new Error('Receiving unknown message type')
    }

    return messages
  }
}

export default Node
