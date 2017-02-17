# connect-cloudant-store

[![NPM Version][npm-image]][npm-url]
[![NPM Downloads][downloads-image]][downloads-url]
[![Build Status][travis-image]][travis-url]

NodeJS express-session storage connector for IBM Cloudant. 
The module is build on top of the cloudant npm module with promises plugin - the official Node JS Cloudant library.

## Setup

```
npm install connect-cloudant-store
```

Using the CloudantStore session storage connector:

```javascript

var session = require('express-session');
var CloudantStore = require('connect-cloudant-store')(session);
// example for local instance of cloudant - required params
// database 'sessions' needs to be created prior to usage
store = new CloudantStore(
    {
        url: 'https://MYUSERNAME:MYPASSWORD@MYACCOUNT.cloudant.com'
    }
);

store.on('connect', function() {
     // Cloudant Session store is ready for use
});

store.on('disconnect', function() {
    // failed to connect to cloudant db - by default falls back to MemoryStore
});

store.on('error', function(err) {
    // You can log the store errors to your app log
});

app.use(session({
    store: store,
    secret: 'keyboard cat'
}));
```

Standard usage for Bluemix environment/dev environment :

```javascript
store = new CloudantStore(
    {
        instanceName: 'cloudant_service_name', 
        vcapServices: JSON.parse(process.env.VCAP_SERVICES)
    }
);

app.use(session({
    store: store,
    secret: 'keyboard cat'
}));
```

## Store Parameters

Bellow is an example of creating an instance with the full list of parameters (default values highlighted):

```javascript
var store = new CloudantStore({
        // connector specific parameters
        client: null, // new Cloudant(options)
        database: 'sessions',
        prefix: 'sess',
        ttl: 86400,
        disableTTLRefresh: false,
        // Cloudant() parameters used if 'client' is not provided
        url: undefined,
        instanceName: undefined,
        vcapServices: undefined,
    }
);

```

### Parameters

### url
Allows to create the Cloudant client based on the url

ex:

https://MYUSERNAME:MYPASSWORD@MYACCOUNT.cloudant.com

Can be used for working on a dev environment (ex: docker cloudant-developer) 

http://MYUSERNAME:MYPASSWORD@LOCALIP:LOCALPORT

### vcapServices && instanceName
Allows to create the Cloudant client based on vcapServices JSON entry for your application and the name of the instance.

See: https://github.com/cloudant/nodejs-cloudant#initialization

### client
Offers the mechanism to inject an instance of Cloudant() module as the client  -> replaces any of the Cloudant parameters above

### ttl
session/storage time to live - overrides the session cookie maxAge value if present

### prefix
Custom prefix to be appended for all session keys

### database
Set a different database as the session database - needs to be created prior to the connector usage.

### disableTTLRefresh
Disable the session storage TTL automatical refresh by disabling the "touch" method, in order to reduce the number of requests
to Cloudant and the risk of conflicts. As a result the session will have a fixed duration from creation (of either the .ttl param or of the session.cookie.maxAge)

## Debugging

Local development

```bash
export DEBUG=connect:cloudant-store
# then run your Node.js application
npm start
```

For Bluemix - use the manifest.yml file to inject the ENV variable:

```yml
# ...
env:
    DEBUG: connect:cloudant-store
  services:
  - my-cloudant-service
```

## Contributing

PR code needs to pass the eslint check and unit test

```
npm test
```

PR code should be covered by UT

```
npm run coverage
```

### Resources

- https://cloudant.com/
- https://console.ng.bluemix.net/catalog/services/cloudant-nosql-db/
- https://github.com/cloudant/nodejs-cloudant
- https://www.npmjs.com/package/express-session
- https://hub.docker.com/r/ibmcom/cloudant-developer/

### Attributions
- The connect-cloudant-store code is inspired from from other express-session storage libraries as: connect-redis.

[npm-image]: https://img.shields.io/npm/v/connect-cloudant-store.svg
[npm-url]: https://npmjs.org/package/connect-cloudant-store
[travis-image]: https://img.shields.io/travis/adriantanasa/connect-cloudant-store/master.svg
[travis-url]: https://travis-ci.org/adriantanasa/connect-cloudant-store
[downloads-image]: https://img.shields.io/npm/dm/connect-cloudant-store.svg
[downloads-url]: https://npmjs.org/package/connect-cloudant-store