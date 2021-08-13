'use strict'

/* eslint-env jest */

import { Model } from "../../src/targets/services/helpers"

describe('Model library', () => {
  const mockDocs = [
    {
      label: "aa aaa aaaa",
      cozyCategoryId: "100"
    }, {
      label: "aaapi aac aad",
      cozyCategoryId: "200"
    }, {
      label: "aaapi aaa aa",
    }, {
      label: "aaapi aac aa",
    },
  ]

  const mockDocs2 = [
    {
      label: "aac aafip aafflelou",
      cozyCategoryId: "200"
    }, {
      label: "aar aarpi aat",
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
      console.log('should gives the same result as a centralized dataset')
      const nbShares = 2
      const firstModel = Model.fromDocs(mockDocs)
      const secondModel = Model.fromDocs(mockDocs2)
      const shares1 = firstModel.getShares(nbShares)
      const shares2 = secondModel.getShares(nbShares)
      const agg1 = Model.fromShares([shares1[0], shares2[0]])
      const agg2 = Model.fromShares([shares1[1], shares2[1]])
      console.log(agg1.contributions, agg2.contributions)
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
      expect(shares[0].occurences).not.toEqual(shares[1].occurences)
      expect(shares[0].occurences).not.toEqual(shares[2].occurences)
    })

    it('should generate coherent shares', () => {
      const nbShares = 3
      const firstModel = Model.fromDocs(mockDocs)
      const shares = firstModel.getShares(nbShares)
      const model = Model.fromShares(shares, true)
      expect(firstModel.occurences).toEqual(model.occurences)
    })
  })
})
