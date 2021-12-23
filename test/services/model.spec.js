'use strict'

/* eslint-env jest */

import { Model, vocabulary } from '../../src/targets/services/helpers'

describe('Model library', () => {
  const mockDocs = [
    {
      label: [vocabulary[0], vocabulary[1], vocabulary[2]].join(' '),
      cozyCategoryId: '100'
    },
    {
      label: [vocabulary[3], vocabulary[4], vocabulary[5]].join(' '),
      cozyCategoryId: '200'
    },
    {
      label: [vocabulary[3], vocabulary[5], vocabulary[5]].join(' '),
      cozyCategoryId: '200'
    },
    {
      label: [vocabulary[3], vocabulary[1], vocabulary[2]].join(' ')
    },
    {
      label: [vocabulary[6], vocabulary[5], vocabulary[4]].join(' ')
    },
    {
      label: 'bgsdhgisuh bghebgo gjnpjrgpgnjezjn vnsdflkjnio',
      cozyCategoryId: '200'
    }
  ]

  const mockDocs2 = [
    {
      label: [vocabulary[0], vocabulary[1], vocabulary[2]].join(' '),
      cozyCategoryId: '200'
    },
    {
      label: [vocabulary[3], vocabulary[4], vocabulary[5]].join(' '),
      cozyCategoryId: '200'
    }
  ]

  describe('fromDocs', () => {
    it('should increment the correct occurences', () => {
      const model = Model.fromDocs(mockDocs)
      expect(model.occurences[0][1]).toEqual(1)
      expect(model.occurences[1][1]).toEqual(1)
      expect(model.occurences[2][1]).toEqual(1)
      expect(model.occurences[3][2]).toEqual(2)
      expect(model.occurences[4][2]).toEqual(1)
      expect(model.occurences[5][2]).toEqual(3)
    })
  })

  describe('fromShares', () => {
    it('should increment the correct occurences', () => {
      const nbShares = 2
      const firstModel = Model.fromDocs(mockDocs)
      const shares = firstModel.getShares(nbShares)
      const model = Model.fromShares(shares, { shouldFinalize: true })
      expect(model.occurences[0][1]).toEqual(1)
      expect(model.occurences[1][1]).toEqual(1)
      expect(model.occurences[2][1]).toEqual(1)
      expect(model.occurences[3][2]).toEqual(2)
      expect(model.occurences[4][2]).toEqual(1)
      expect(model.occurences[5][2]).toEqual(3)
    })

    it('should gives the same result as a centralized dataset', () => {
      const nbShares = 2
      const firstModel = Model.fromDocs(mockDocs)
      const secondModel = Model.fromDocs(mockDocs2)
      const shares1 = firstModel.getShares(nbShares)
      const shares2 = secondModel.getShares(nbShares)
      const agg1 = Model.fromShares([shares1[0], shares2[0]])
      const agg2 = Model.fromShares([shares1[1], shares2[1]])
      const modelRecomposed = Model.fromShares(
        [agg1.getAggregate(), agg2.getAggregate()],
        { shouldFinalize: true }
      )
      const model = Model.fromDocs(mockDocs.concat(mockDocs2))

      for (let i = 0; i < 5; i++) {
        expect(modelRecomposed.occurences[i]).toEqual(model.occurences[i])
      }
    })
  })

  describe('fromAggregate & getAggregate', () => {
    it('should preserve the correct occurences', () => {
      const firstModel = Model.fromDocs(mockDocs)
      const aggregate = firstModel.getAggregate()
      const model = Model.fromAggregate(aggregate, { shouldFinalize: true })
      expect(model.occurences[0][1]).toEqual(1)
      expect(model.occurences[1][1]).toEqual(1)
      expect(model.occurences[2][1]).toEqual(1)
      expect(model.occurences[3][2]).toEqual(2)
      expect(model.occurences[4][2]).toEqual(1)
      expect(model.occurences[5][2]).toEqual(3)
    })
  })

  describe('fromCompressedAggregate & getCompressedAggregate', () => {
    it('should preserve the correct occurences', () => {
      const firstModel = Model.fromDocs(mockDocs)
      const aggregate = firstModel.getCompressedAggregate()
      const model = Model.fromCompressedAggregate(aggregate, {
        shouldFinalize: true
      })
      expect(model.occurences[0][1]).toEqual(1)
      expect(model.occurences[1][1]).toEqual(1)
      expect(model.occurences[2][1]).toEqual(1)
      expect(model.occurences[3][2]).toEqual(2)
      expect(model.occurences[4][2]).toEqual(1)
      expect(model.occurences[5][2]).toEqual(3)
    })
  })

  describe('predict', () => {
    it('should classify labels', () => {
      const model = Model.fromDocs(mockDocs)
      expect(model.predict(mockDocs[3].label)).toEqual('100')
      expect(model.predict(mockDocs[4].label)).toEqual('200')
    })

    it('should send uncategorized when only unknown tokens', () => {
      const model = Model.fromDocs(mockDocs)
      expect(model.predict('bloubliblou')).toEqual('0')
    })
  })

  describe('getShares', () => {
    it('should generate different shares', () => {
      const nbShares = 3
      const firstModel = Model.fromDocs(mockDocs)
      const shares = firstModel.getShares(nbShares)
      expect(shares[0]).not.toEqual(shares[1])
      expect(shares[0]).not.toEqual(shares[2])
    })

    it('should generate coherent shares', () => {
      const nbShares = 3
      const firstModel = Model.fromDocs(mockDocs)
      const shares = firstModel.getShares(nbShares)
      const model = Model.fromShares(shares, { shouldFinalize: true })

      for (let i = 0; i < 5; i++) {
        expect(firstModel.occurences[i]).toEqual(model.occurences[i])
      }
    })

    it('should fail when mixing different shares', () => {
      const nbShares = 3
      const model = Model.fromDocs(mockDocs)
      const firstShares = model.getShares(nbShares)
      const firstModel = Model.fromShares(firstShares, { shouldFinalize: true })
      const secondShares = model.getShares(nbShares)
      const secondModel = Model.fromShares(
        [firstShares[0], secondShares[1], firstShares[2]],
        { shouldFinalize: true }
      )

      for (let i = 0; i < 5; i++) {
        expect(firstModel.occurences[i] !== secondModel.occurences[i]).toBeTruthy()
      }
    })
  })

  describe('share to/from compressed binary', () => {
    it('should convert from one to the other without error', () => {
      const nbShares = 3
      const originalModel = Model.fromDocs(mockDocs)
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
})
