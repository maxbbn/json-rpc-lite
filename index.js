var net = require('net')
var logger = console;
var chunkMaxLength = 1024 * 256
var id = 0

function JSONRpc(port, host) {
  this._port = port
  this._host = host
  this._byteLength = 0
  this._chunks = []
  this._id = (id++).toString()
}

JSONRpc.prototype.makeCall = function (method, params, timeout) {
  return new Promise((resolve, reject) => {
    this._method = method
    this._params = params
    this._timeout = timeout || 5000
    this._resolve = resolve
    this._reject = reject
    this._socket = net.createConnection({
      host: this._host,
      port: this._port,
    })
    this._socket.once('connect', this._onConnect.bind(this))
    this._socket.on('data', this._onData.bind(this))
    this._socket.on('drain', this._onDrain.bind(this))
    this._socket.once('error', this._onError.bind(this))
    this._timer = setTimeout(
      this._onTimeout.bind(this, 'connect'),
      this._timeout
    )
  })
}

JSONRpc.prototype._onConnect = function () {
  clearTimeout(this._timer)
  this._timer = setTimeout(
    this._onTimeout.bind(this, 'make call'),
    this._timeout
  )
  var body = {
    jsonrpc: '2.0',
    method: this._method,
    params: this._params,
    id: this._id,
  }
  this._socket.end(JSON.stringify(body))
}

JSONRpc.prototype._onDrain = function () {
  this._socket.resume()
}

JSONRpc.prototype._onError = function (err) {
  this._reject(err)
}

JSONRpc.prototype._onTimeout = function (from) {
  logger.error(`ssdp tcp ${from} timeout ${this._method} ${this._host}`)
  this._onError(new Error(`JSONRPC ${from} timeout`))
}

JSONRpc.prototype._onData = function (chunk) {
  this._byteLength += chunk.byteLength
  if (this._byteLength > chunkMaxLength) {
    this._socket.destroy(new Error('too many chunks'))
  } else {
    this._chunks.push(chunk)
    this._parseData()
  }
}

JSONRpc.prototype._parseData = function () {
  var buf = Buffer.concat(this._chunks)
  var res
  try {
    res = JSON.parse(buf.toString('utf8'))
  } catch (err) {
    return false
  }
  clearTimeout(this._timer)
  if (res.id !== this._id && res.id !== this._id.toString()) {
    this._socket.destroy(new Error('invalid json rpc id'))
    return
  }
  if (res.error) {
    var err = new Error(res.error.message)
    err.code = res.error.code
    err.errorName = res.error.data
    this._socket.destroy(err)
  } else {
    this._resolve(res.result)
    setTimeout(() => {
      this._socket.destroy()
    }, 0)
  }
  return true
}


module.exports = function (locationInfo, method, params) {
  var rpc = new JSONRpc(locationInfo.port, locationInfo.hostname)
  return rpc.makeCall(method, params)
}