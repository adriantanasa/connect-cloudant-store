/**
 * Connect - Cloudant Store
 * Copyright(c) 2017 Adrian Tanasa
 *
 * MIT Licensed
 *
 * This is an adaption from connect-redis, see:
 * https://github.com/visionmedia/connect-redis
 */

var debug = require('debug')('connect:cloudant-store');
var util = require('util');
var _ = require('lodash');
var Cloudant = require('cloudant');
var noop = function() {};

/**
 * Return the `CloudantStore` extending `express`'s session Store.
 *
 * @param {object} express session
 * @return {Function}
 * @api public
 */
module.exports = function(session) {

    var self;

    /**
     * One day in seconds.
     */
    var oneDay = 86400;

    var getTTL = function(store, sess) {
        var maxAge = sess.cookie && sess.cookie.maxAge ? sess.cookie.maxAge : null;
        return store.ttl || (typeof maxAge === 'number' ? Math.floor(maxAge / 1000) : oneDay);
    };

    var sessionToDb = function(sid, sess, ttl) {
        var dbData = _.assign({}, JSON.parse(JSON.stringify(sess)),
            {_id: sid, session_ttl: ttl, session_modified: Date.now()});
        return dbData;
    };

    /**
     * Express's session Store.
     */
    var Store = session.Store;

    /**
     * Initialize CloudantStore with the given `options`.
     *
     * @param {Object} options
     * @api public
     */
    function CloudantStore(options) {
        if (!(this instanceof CloudantStore)) {
            throw new TypeError('Cannot call CloudantStore constructor as a function');
        }
        self = this;
        options = options || {};
        Store.call(this, options);

        this.prefix = options.prefix || 'sess:';
        // force promise plugin - TODO replace with a retry-promise plugin
        options.plugin = 'promises';
        this.ttl = options.ttl || null;
        this.disableTTLRefresh = options.disableTTLRefresh || false;
        if (options.client) {
            this.client = options.client;
        } else {
            this.client = new Cloudant(options);
        }

        this.db = this.client.use(options.database || 'sessions');
        this.checkClientConnection();
    }

    /**
     * Inherit from `Store`.
     */
    util.inherits(CloudantStore, Store);

    /**
     * Attempt to fetch session by the given `sid`.
     *
     * @param {String} sid
     * @param {sessCallback} fn
     * @api public
     */
    CloudantStore.prototype.get = function(sid, fn) {
        debug('GET "%s"', sid);
        fn = fn || noop;

        self.db.get(self.prefix + sid)
        .then(function(data) {
            if (data.session_modified + data.session_ttl * 1000 < Date.now()) {
                debug('GET "%s" expired session', sid);
                self.destroy(sid, fn);
                return fn();
            } else {
                debug('GET "%s" found rev "%s"', sid, data._rev);
                return fn(null, data);
            }
        })
        .catch(function(err) {
            if (err.statusCode == 404) {
                debug('GET - SESSION NOT FOUND "%s"', sid);
                return fn();
            } else {
                // TODO 429 errors from a custom promise-retry cloudant plugin
                debug('GET ERROR  "%s" err "%s"', sid,
                    JSON.stringify(err));
                self.emit('error', err);
                return fn(err);
            }
        });
    };

    /**
     * Commit the given `sess` object associated with the given `sid`.
     *
     * @param {String} sid
     * @param {Session} sess
     * @param {sessCallback} fn
     * @api public
     */
    CloudantStore.prototype.set = function(sid, sess, fn) {
        fn = fn || noop;
        // read current _rev
        self.db.head(self.prefix + sid, function(err, _, headers) {
            delete sess._rev;
            if (!err && headers && headers.etag) {
                sess._rev = headers.etag.replace(/"/g, '');
            } else if (err && !(err.statusCode && err.statusCode == 404)) {
                debug('SET session error "%s" rev "%s" err "%s"', sid, sess._rev,
                    JSON.stringify(err));
                self.emit('error', err);
                return fn(err);
            }

            debug('SET session "%s" rev "%s"', sid, sess._rev);
            self.db.insert(sessionToDb(self.prefix + sid, sess, getTTL(self, sess)))
            .then(function() {
                return fn(null, null);
            })
            .catch(function(err) {
                debug('SET session error "%s" rev "%s" err "%s"', sid, sess._rev,
                    JSON.stringify(err));
                self.emit('error', err);
                return fn(err);
            });
        });
    };

    /**
     * Destroy the session associated with the given `sid`.
     *
     * @param {String} sid
     * @param {sessCallback} fn
     * @api public
     */
    CloudantStore.prototype.destroy = function(sid, fn) {
        debug('DESTROY session "%s"', sid);
        fn = fn || noop;
        // get _rev needed for delete
        // TODO check why db.head is not working
        self.db.get(self.prefix + sid).then(function(data) {
            // cleanup expired sessions
            self.db.destroy(self.prefix + sid, data._rev)
            .catch(function(err) {
                debug('DESTROY - DB error "%s" rev "%s" err "%s"', sid, data._rev,
                JSON.stringify(err));
                self.emit('error', err);
                return fn(err);
            });
        }).catch(function(err) {
            debug('DESTROY - DB GET failure "%s" err "%s"', sid, JSON.stringify(err));
            self.emit('error', err);
            return fn(err);
        });
    };

    /**
     * Refresh the time-to-live for the session with the given `sid`.
     *
     * @param {String} sid
     * @param {Session} sess
     * @param {sessCallback} fn
     * @api public
     */
    CloudantStore.prototype.touch = function(sid, sess, fn) {
        fn = fn || noop;
        if (self.disableTTLRefresh) return fn();
        debug('TOUCH session "%s" rev "%s"', sid, sess._rev);

        self.db.get(self.prefix + sid)
        .then(function(data) {
            // update TTL
            sess._rev = data._rev;
            self.db.insert(sessionToDb(self.prefix + sid, data, getTTL(self, sess)))
            .then(function() {
                return fn(null, null);
            })
            .catch(function(err) {
                debug('TOUCH session error "%s" rev "%s" err "%s"', sid, sess._rev,
                    JSON.stringify(err));
                self.emit('error', err);
                return fn(err);
            });
        })
        .catch(function(err) {
            debug('TOUCH - error on returning the session "%s" rev "%s" err "%s"',
                sid, sess._rev, JSON.stringify(err));
            self.emit('error', err);
            return fn(err);
        });
    };

    CloudantStore.prototype.checkClientConnection = function() {
        return self.db.info()
        .then(function() {
            self.emit('connect');
        })
        .catch(function(err) {
            self.emit('disconnect');
            debug('DATABASE does not exists %s', JSON.stringify(err));
        });
    };

    return CloudantStore;
};
