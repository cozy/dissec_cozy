// eslint-disable-next-line no-console
var originalConsoleLog = console.log
const createLogger = function(initialTag) {
  let tag = initialTag

  return {
    log: function() {
      let args = []

      if (tag) {
        args.push('[' + tag + '] ')
      }

      for (var i = 0; i < arguments.length; i++) {
        args.push(arguments[i])
      }

      originalConsoleLog.apply(console, args)
    },
    setTag: newTag => {
      tag = newTag
    }
  }
}

module.exports = {
  createLogger
}
