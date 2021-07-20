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

  describe('fromDocs', () => {
    it('should increment the correct occurences', () => {
      const model = Model.fromDocs(mockDocs)
      expect(model.occurences[0][1]).toEqual(2)
      expect(model.occurences[1][1]).toEqual(2)
      expect(model.occurences[2][1]).toEqual(2)
      expect(model.occurences[3][2]).toEqual(2)
      expect(model.occurences[4][2]).toEqual(2)
      expect(model.occurences[5][2]).toEqual(2)
    })
  })

  describe('fromShares', () => {
    it('should increment the correct occurences', () => {
      const nbShares = 2
      const firstModel = Model.fromDocs(mockDocs)
      const shares = firstModel.getShares(nbShares)
      const model = Model.fromShares(shares, true)
      expect(model.occurences[0][1]).toEqual(2)
      expect(model.occurences[1][1]).toEqual(2)
      expect(model.occurences[2][1]).toEqual(2)
      expect(model.occurences[3][2]).toEqual(2)
      expect(model.occurences[4][2]).toEqual(2)
      expect(model.occurences[5][2]).toEqual(2)
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
      expect(shares[0].occurences[0][1]).not.toEqual(shares[1].occurences[0][1])
      expect(shares[0].occurences[0][1]).not.toEqual(shares[2].occurences[0][1])
      expect(shares[1].occurences[0][1]).not.toEqual(shares[2].occurences[0][1])
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
