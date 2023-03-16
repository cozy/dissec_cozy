'use strict'
import { vocabulary } from '.'
import { Model } from '../model'

/* eslint-env jest */

describe('Model library', () => {
  const mockDocs = [
    {
      label: [vocabulary[0], vocabulary[1], vocabulary[2]].join(' '),
      manualCategoryId: '100'
    },
    {
      label: [vocabulary[3], vocabulary[4], vocabulary[5]].join(' '),
      manualCategoryId: '200'
    },
    {
      label: [vocabulary[3], vocabulary[5], vocabulary[5]].join(' '),
      manualCategoryId: '200'
    },
    {
      label: [vocabulary[3], vocabulary[1], vocabulary[2]].join(' ')
    },
    {
      label: [vocabulary[6], vocabulary[5], vocabulary[4]].join(' ')
    },
    {
      label: 'bgsdhgisuh bghebgo gjnpjrgpgnjezjn vnsdflkjnio',
      manualCategoryId: '200'
    }
  ]

  const mockDocs2 = [
    {
      label: [vocabulary[0], vocabulary[1], vocabulary[2]].join(' '),
      manualCategoryId: '200'
    },
    {
      label: [vocabulary[3], vocabulary[4], vocabulary[5]].join(' '),
      manualCategoryId: '200'
    }
  ]

  describe('fromDocs', () => {
    it('should increment the correct occurences', async () => {
      const model = await Model.fromDocs(mockDocs)
      expect(
        model.classifiers[0].wordFrequencyCount['100'][vocabulary[0]]
      ).toEqual(1)
      expect(
        model.classifiers[0].wordFrequencyCount['100'][vocabulary[1]]
      ).toEqual(1)
      expect(
        model.classifiers[0].wordFrequencyCount['100'][vocabulary[2]]
      ).toEqual(1)
      expect(
        model.classifiers[0].wordFrequencyCount['200'][vocabulary[3]]
      ).toEqual(2)
      expect(
        model.classifiers[0].wordFrequencyCount['200'][vocabulary[4]]
      ).toEqual(1)
      expect(
        model.classifiers[0].wordFrequencyCount['200'][vocabulary[5]]
      ).toEqual(3)
    })
  })

  describe('fromShares', () => {
    it('should increment the correct occurences', async () => {
      const nbShares = 2
      const firstModel = await Model.fromDocs(mockDocs)
      const shares = firstModel.getShares(nbShares)
      const model = Model.fromShares(shares, { shouldFinalize: true })
      expect(
        model.classifiers[0].wordFrequencyCount['100'][vocabulary[0]]
      ).toEqual(1)
      expect(
        model.classifiers[0].wordFrequencyCount['100'][vocabulary[1]]
      ).toEqual(1)
      expect(
        model.classifiers[0].wordFrequencyCount['100'][vocabulary[2]]
      ).toEqual(1)
      expect(
        model.classifiers[0].wordFrequencyCount['200'][vocabulary[3]]
      ).toEqual(2)
      expect(
        model.classifiers[0].wordFrequencyCount['200'][vocabulary[4]]
      ).toEqual(1)
      expect(
        model.classifiers[0].wordFrequencyCount['200'][vocabulary[5]]
      ).toEqual(3)
    })

    it('should gives the same result as a centralized dataset', async () => {
      const nbShares = 2
      const firstModel = await Model.fromDocs(mockDocs)
      const secondModel = await Model.fromDocs(mockDocs2)
      const shares1 = firstModel.getShares(nbShares)
      const shares2 = secondModel.getShares(nbShares)
      const agg1 = Model.fromShares([shares1[0], shares2[0]])
      const agg2 = Model.fromShares([shares1[1], shares2[1]])
      const modelRecomposed = Model.fromShares(
        [agg1.getAggregate(), agg2.getAggregate()],
        { shouldFinalize: true }
      )
      const model = await Model.fromDocs(mockDocs.concat(mockDocs2))

      for (const key of ['100', '200']) {
        for (const word of vocabulary) {
          expect(
            modelRecomposed.classifiers[0].wordFrequencyCount[key][word]
          ).toEqual(model.classifiers[0].wordFrequencyCount[key][word])
        }
      }
    })
  })

  describe('fromAggregate & getAggregate', () => {
    it('should preserve the correct occurences', async () => {
      const firstModel = await Model.fromDocs(mockDocs)
      const aggregate = firstModel.getAggregate()
      const model = await Model.fromAggregate(aggregate, {
        shouldFinalize: true
      })
      expect(
        model.classifiers[0].wordFrequencyCount['100'][vocabulary[0]]
      ).toEqual(1)
      expect(
        model.classifiers[0].wordFrequencyCount['100'][vocabulary[1]]
      ).toEqual(1)
      expect(
        model.classifiers[0].wordFrequencyCount['100'][vocabulary[2]]
      ).toEqual(1)
      expect(
        model.classifiers[0].wordFrequencyCount['200'][vocabulary[3]]
      ).toEqual(2)
      expect(
        model.classifiers[0].wordFrequencyCount['200'][vocabulary[4]]
      ).toEqual(1)
      expect(
        model.classifiers[0].wordFrequencyCount['200'][vocabulary[5]]
      ).toEqual(3)
    })
  })

  describe('fromCompressedAggregate & getCompressedAggregate', () => {
    it('should preserve the correct occurences', async () => {
      const firstModel = await Model.fromDocs(mockDocs)
      const aggregate = firstModel.getCompressedAggregate()
      const model = await Model.fromCompressedAggregate(aggregate, {
        shouldFinalize: true
      })
      expect(
        model.classifiers[0].wordFrequencyCount['100'][vocabulary[0]]
      ).toEqual(1)
      expect(
        model.classifiers[0].wordFrequencyCount['100'][vocabulary[1]]
      ).toEqual(1)
      expect(
        model.classifiers[0].wordFrequencyCount['100'][vocabulary[2]]
      ).toEqual(1)
      expect(
        model.classifiers[0].wordFrequencyCount['200'][vocabulary[3]]
      ).toEqual(2)
      expect(
        model.classifiers[0].wordFrequencyCount['200'][vocabulary[4]]
      ).toEqual(1)
      expect(
        model.classifiers[0].wordFrequencyCount['200'][vocabulary[5]]
      ).toEqual(3)
    })
  })

  describe('predict', () => {
    it('should classify labels', async () => {
      const model = await Model.fromDocs(mockDocs)
      expect(model.predict(mockDocs[3].label)).toEqual('100')
      expect(model.predict(mockDocs[4].label)).toEqual('200')
    })

    it('should send uncategorized when only unknown tokens', async () => {
      const model = await Model.fromDocs(mockDocs)
      expect(model.predict('bloubliblou')).toEqual('0')
    })
  })

  describe('getShares', () => {
    it('should generate different shares', async () => {
      const nbShares = 3
      const firstModel = await Model.fromDocs(mockDocs)
      const shares = firstModel.getShares(nbShares)
      expect(shares[0]).not.toEqual(shares[1])
      expect(shares[0]).not.toEqual(shares[2])
    })

    it('should generate coherent shares', async () => {
      const nbShares = 3
      const firstModel = await Model.fromDocs(mockDocs)
      const shares = firstModel.getShares(nbShares)
      const model = Model.fromShares(shares, { shouldFinalize: true })

      for (let i = 0; i < 5; i++) {
        expect(firstModel.occurences[i]).toEqual(model.occurences[i])
      }
    })

    it('should fail when mixing different shares', async () => {
      const nbShares = 3
      const model = await Model.fromDocs(mockDocs)
      const firstShares = model.getShares(nbShares)
      const firstModel = Model.fromShares(firstShares, { shouldFinalize: true })
      const secondShares = model.getShares(nbShares)
      const secondModel = Model.fromShares(
        [firstShares[0], secondShares[1], firstShares[2]],
        { shouldFinalize: true }
      )

      for (let i = 0; i < 5; i++) {
        expect(
          firstModel.occurences[i] !== secondModel.occurences[i]
        ).toBeTruthy()
      }
    })
  })

  describe('share to/from compressed binary', () => {
    it('should convert from one to the other without error', async () => {
      const nbShares = 3
      const originalModel = await Model.fromDocs(mockDocs)
      const shares = originalModel.getShares(nbShares)
      const compressedShares = originalModel.getCompressedShares(nbShares)

      const modelFromShares = Model.fromShares(shares, { shouldFinalize: true })
      const modelFromCompressedShares = Model.fromCompressedShares(
        compressedShares,
        { shouldFinalize: true }
      )

      for (let i = 0; i < 5; i++) {
        expect(modelFromShares.occurences[i]).toEqual(
          originalModel.occurences[i]
        )
      }
      for (let i = 0; i < 5; i++) {
        expect(modelFromCompressedShares.occurences[i]).toEqual(
          originalModel.occurences[i]
        )
      }
    })
  })

  describe('small tree', () => {
    it('should convert from one to the other without error', async () => {
      const nbContributors = 5
      const contributorsModel = await Promise.all(
        Array(nbContributors)
          .fill(0)
          .map(async () => Model.fromDocs(mockDocs))
      )

      const nbShares = 3
      const contributorShares = contributorsModel.map(model =>
        model.getCompressedShares(nbShares)
      )

      const aggregatorShares = []
      for (let j = 0; j < nbShares; j++) {
        let shares = []
        for (let i = 0; i < nbContributors; i++) {
          shares.push(contributorShares[i][j])
        }
        aggregatorShares.push(shares)
      }

      const aggregates = aggregatorShares.map(shares =>
        Model.fromCompressedShares(shares).getCompressedAggregate()
      )
      const finalModel = Model.fromCompressedShares(aggregates, {
        shouldFinalize: true
      })

      expect(finalModel.occurences[1][0]).toEqual(1 * nbContributors)
      expect(finalModel.occurences[1][1]).toEqual(1 * nbContributors)
      expect(finalModel.occurences[1][2]).toEqual(1 * nbContributors)
      expect(finalModel.occurences[2][3]).toEqual(2 * nbContributors)
      expect(finalModel.occurences[2][4]).toEqual(1 * nbContributors)
      expect(finalModel.occurences[2][5]).toEqual(3 * nbContributors)
    })
  })
})
