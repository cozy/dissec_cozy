const splitClasses = require('./splitClasses')

test('Returns a list of list of classes', () => {
  jest.spyOn(console, 'log').mockImplementation(() => jest.fn())

  splitClasses(4, 2)

  expect(console.log).toHaveBeenCalledWith('0,100 200,300 200000,200100 200110,200120')
})
