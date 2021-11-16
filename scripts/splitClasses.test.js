const splitClasses = require('./splitClasses').splitClasses

test('Returns a list of list of classes', () => {
  const oldLog = console.log
  console.log = jest.fn()

  splitClasses(4, 2)

  // The first argument of the first call to the function was 'hello'
  expect(console.log.mock.calls[0][0]).toBe(
    '0,100 200,300 200000,200100 200110,200120'
  )
})
