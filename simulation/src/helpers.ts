import cloneDeep from 'lodash/cloneDeep'
import isEqual from 'lodash/isEqual'

export const arrayEquals = (a: number[], b: number[]): boolean => {
  return isEqual(cloneDeep(a).sort(), cloneDeep(b).sort())
}

export const intersectLists = (a: number[], b: number[]): number[] => {
  const sb = new Set(b)
  return Array.from(cloneDeep(a).filter(x => sb.has(x))).sort()
}
