// eslint-disable-next-line no-console
var originalConsoleLog = console.log
export const createLogger = function(uri) {
  return function() {
    let args = []
    args.push('[' + uri.split('/')[2] + '] ')
    for (var i = 0; i < arguments.length; i++) {
      args.push(arguments[i])
    }
    originalConsoleLog.apply(console, args)
  }
}
