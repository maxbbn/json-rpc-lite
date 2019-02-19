var jsonrpc = require('./index');

var location = {
  port: 8902,
  hostname: '127.0.0.1',
};

jsonrpc(location, 'list', {})
  .then((result) => {
    console.log('-- result --')
    console.log(JSON.stringify(result, null, 2))
  })
  .catch(err => {
    console.log('-- error --')
    console.error(err.stack)
  })