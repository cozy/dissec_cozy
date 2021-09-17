'use strict'

/* eslint-env jest */

import vocabulary from '../../src/targets/services/helpers/vocabulary_tiny.json'
import { Model } from "../../src/targets/services/helpers"

describe('Model library', () => {
  const mockDocs = [
    {
      label: [vocabulary[0], vocabulary[1], vocabulary[2]].join(" "),
      cozyCategoryId: "100"
    }, {
      label: [vocabulary[3], vocabulary[4], vocabulary[5]].join(" "),
      cozyCategoryId: "200"
    }, {
      label: [vocabulary[3], vocabulary[1], vocabulary[2]].join(" "),
    }, {
      label: [vocabulary[6], vocabulary[5], vocabulary[4]].join(" "),
    },
  ]

  const mockDocs2 = [
    {
      label: [vocabulary[0], vocabulary[1], vocabulary[2]].join(" "),
      cozyCategoryId: "200"
    }, {
      label: [vocabulary[3], vocabulary[4], vocabulary[5]].join(" "),
      cozyCategoryId: "200"
    }
  ]

  describe('fromDocs', () => {
    it('should increment the correct occurences', () => {
      const model = Model.fromDocs(mockDocs)
      expect(model.occurences[0][1]).toEqual(1)
      expect(model.occurences[1][1]).toEqual(1)
      expect(model.occurences[2][1]).toEqual(1)
      expect(model.occurences[3][2]).toEqual(1)
      expect(model.occurences[4][2]).toEqual(1)
      expect(model.occurences[5][2]).toEqual(1)
    })
  })

  describe('fromShares', () => {
    it('should increment the correct occurences', () => {
      const nbShares = 2
      const firstModel = Model.fromDocs(mockDocs)
      const shares = firstModel.getShares(nbShares)
      const model = Model.fromShares(shares, true)
      expect(model.occurences[0][1]).toEqual(1)
      expect(model.occurences[1][1]).toEqual(1)
      expect(model.occurences[2][1]).toEqual(1)
      expect(model.occurences[3][2]).toEqual(1)
      expect(model.occurences[4][2]).toEqual(1)
      expect(model.occurences[5][2]).toEqual(1)
    })

    it('should gives the same result as a centralized dataset', () => {
      const nbShares = 2
      const firstModel = Model.fromDocs(mockDocs)
      const secondModel = Model.fromDocs(mockDocs2)
      const shares1 = firstModel.getShares(nbShares)
      const shares2 = secondModel.getShares(nbShares)
      const agg1 = Model.fromShares([shares1[0], shares2[0]])
      const agg2 = Model.fromShares([shares1[1], shares2[1]])
      const modelRecomposed = Model.fromShares([agg1.getBackup(), agg2.getBackup()], true)
      const model = Model.fromDocs(mockDocs.concat(mockDocs2))
      expect(modelRecomposed.occurences).toEqual(model.occurences)
    })
  })

  describe('predict', () => {
    it('should classify labels', () => {
      const model = Model.fromDocs(mockDocs)
      expect(model.predict(mockDocs[2].label)).toEqual("100")
      expect(model.predict(mockDocs[3].label)).toEqual("200")
    })

    it('should send uncategorized when only unknown tokens', () => {
      const model = Model.fromDocs(mockDocs)
      expect(model.predict("bloubliblou")).toEqual("0")
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
      const model = Model.fromShares(shares, true)
      expect(firstModel.occurences).toEqual(model.occurences)
    })
  })

  describe('share to/from compressed binary', () => {
    it('should convert from one to the other without error', () => {
      const nbShares = 3
      const originalModel = Model.fromDocs(mockDocs)
      const shares = originalModel.getShares(nbShares)
      const compressedShares = originalModel.getCompressedShares(nbShares)

      const modelFromShares = Model.fromShares(shares, true)
      const modelFromCompressedShares = Model.fromCompressedShares(compressedShares, true)
      expect(modelFromShares.occurences).toEqual(originalModel.occurences)
      expect(modelFromCompressedShares.occurences).toEqual(originalModel.occurences)
    })
  })
})
