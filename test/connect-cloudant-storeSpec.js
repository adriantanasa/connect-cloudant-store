'use strict';

var expect = require('chai').expect,
    sinon = require('sinon'),
    Cloudant = require('cloudant'),
    session = require('express-session'),
    CloudantStore = require('../lib/connect-cloudant-store')(session);

describe('Testsuite - CloudantStore', function() {
    var clientGetDbStub,
        dbInfoStub,
        dbHeadStub,
        dbInsertStub,
        dbGetStub,
        dbDestroyStub;

    var goodClientParams = {
        url: 'http://admin:pass@124.0.0.1:8080',
        ttl: 2000,
        disableTTLRefresh: false,
        database: 'my_session'
    };

    var dbStub = {
        'info': function() {},
        'get': function() {},
        'head': function() {},
        'insert': function() {},
        'destroy': function() {}
    };

    var client = new Cloudant(goodClientParams);
        // dbPutStub,
        // dbDestroyStub,
        // dbHeadStub;

    describe('TestSuite - CloudantStore', function() {
        beforeEach(function() {
            dbInfoStub = sinon.stub(dbStub, 'info');
            dbGetStub = sinon.stub(dbStub, 'get');
            dbHeadStub = sinon.stub(dbStub, 'head');
            dbInsertStub = sinon.stub(dbStub, 'insert');
            dbDestroyStub = sinon.stub(dbStub, 'destroy');
            clientGetDbStub = sinon.stub(client, 'use').returns(dbStub);
            // dbDestroyStub = sinon.stub(Cloudant.prototype, 'destroy');
        });

        afterEach(function() {
            clientGetDbStub.restore();
            dbInfoStub.restore();
            dbGetStub.restore();
            dbHeadStub.restore();
            dbInsertStub.restore();
            dbDestroyStub.restore();
        });

        it('Testcase - failing constructor - required params missing', function() {
            var error = null;
            try {
                var store = new CloudantStore();
            } catch (err) {
                error = err;
            }
            expect(error).not.to.be.null;
            expect(error.message).to.deep.equal('invalid url');
            expect(store).not.to.be.ok;
        });

        it('Testcase - no DB calls emit disconnect', function(done) {
            dbInfoStub.returns(Promise.reject());
            var store = new CloudantStore({
                client: client
            });

            var emitSpy = sinon.spy(store, 'emit');

            setTimeout(function() {
                expect(emitSpy.calledWith('disconnect')).to.be.true;
                done();
            }, 0);
            expect(store).to.be.ok;
        });

        it('Testcase - constructor - good database/connection', function() {
            dbInfoStub.returns(Promise.resolve({}));
            var store = new CloudantStore({
                client: client
            });

            expect(store).to.be.ok;
            expect(store.disableTTLRefresh).to.equal(false);
            expect(store.ttl).to.equal(null);
            expect(clientGetDbStub.calledWith('sessions')).to.be.true;
        });

        it('Testcase - constructor - passing params to client', function() {
            dbInfoStub.returns(Promise.resolve({}));
            var store = new CloudantStore(Object.assign({client: client}, goodClientParams));
            expect(store).to.be.ok;
            expect(store.client).to.be.ok;
            expect(store.disableTTLRefresh).to.equal(false);
            expect(store.ttl).to.equal(goodClientParams.ttl);
            expect(clientGetDbStub.calledWith(goodClientParams.database)).to.be.true;
        });

        it('Testcase - store get - success', function(done) {
            var sessData = {_id: 'sid', _rev: 'rev', session_ttl: 4567, session_modified: Date.now(), data: 'data'};
            var stubCallback = sinon.spy();
            dbGetStub.returns(Promise.resolve(sessData));
            dbInfoStub.returns(Promise.resolve({}));
            var store = new CloudantStore(Object.assign({client: client}, goodClientParams));
            store.get('key', stubCallback);

            setTimeout(function() {
                expect(dbGetStub.calledWith('sess:key')).to.be.true;
                expect(stubCallback.calledWith(null, sessData)).to.equal(true);
                done();
            }, 0);
        });

        it('Testcase - store get - expired session', function(done) {
            var sessData = {_id: 'sid', _rev: 'rev', session_ttl: 1, session_modified: Date.now() - 2000, data: 'data'};
            var stubCallback = sinon.spy();
            dbGetStub.returns(Promise.resolve(sessData));
            dbInfoStub.returns(Promise.resolve({}));
            var store = new CloudantStore(Object.assign({client: client}, goodClientParams));
            store.get('key', stubCallback);

            setTimeout(function() {
                expect(dbGetStub.calledWith('sess:key')).to.be.true;
                expect(stubCallback.calledWith(null, sessData)).to.equal(false);
                done();
            }, 0);
        });

        it('Testcase - store get - error', function(done) {
            var stubCallback = sinon.spy();
            var sessErr = new Error('429 error');
            sessErr.statusCode = 429;
            dbGetStub.returns(Promise.reject(sessErr));
            dbInfoStub.returns(Promise.resolve({}));
            var store = new CloudantStore(Object.assign({client: client}, goodClientParams));
            var emitSpy = sinon.stub(store, 'emit');
            store.get('key', stubCallback);

            setTimeout(function() {
                expect(dbGetStub.calledWith('sess:key')).to.be.true;
                expect(emitSpy.calledWith('error')).to.equal(true);
                done();
            }, 0);
        });

        it('Testcase - store get - 404 error ', function(done) {
            var stubCallback = sinon.spy();
            var sessErr = new Error('404 error');
            sessErr.statusCode = 404;
            dbGetStub.returns(Promise.reject(sessErr));
            dbInfoStub.returns(Promise.resolve({}));
            var store = new CloudantStore(Object.assign({client: client}, goodClientParams));
            var emitSpy = sinon.spy(store, 'emit');
            store.get('key', stubCallback);

            setTimeout(function() {
                expect(dbGetStub.calledWith('sess:key')).to.be.true;
                expect(emitSpy.calledWith('error')).to.equal(false);
                expect(stubCallback.calledWith()).to.equal(true);
                done();
            }, 0);
        });

        it('Testcase - store set - no head - same revision', function(done) {
            var sessData = {_id: 'sess:key', _rev: 'rev-local', data: 'data'};
            var stubCallback = sinon.spy();
            var sessErr = new Error('429 error');
            sessErr.statusCode = 429;

            dbInfoStub.returns(Promise.resolve({}));
            var store = new CloudantStore(Object.assign({client: client}, goodClientParams));
            var emitSpy = sinon.stub(store, 'emit');
            store.set('key', sessData, stubCallback);
            dbHeadStub.callArgWith(1, sessErr);

            setTimeout(function() {
                expect(emitSpy.calledWith('error')).to.be.true;
                expect(stubCallback.called).to.equal(true);
                done();
            }, 0);
        });

        it('Testcase - store set - insert error', function(done) {
            var sessData = {_id: 'sess:key', _rev: 'rev-local', data: 'data'};
            var stubCallback = sinon.spy();
            var sessErr = new Error('404 error');
            sessErr.statusCode = 404;

            dbInfoStub.returns(Promise.resolve({}));
            dbInsertStub.returns(Promise.reject(new Error('Unknown error')));
            var store = new CloudantStore(Object.assign({client: client}, goodClientParams));
            var emitSpy = sinon.stub(store, 'emit');
            store.set('key', sessData, stubCallback);
            dbHeadStub.callArgWith(1, sessErr);

            setTimeout(function() {
                expect(emitSpy.calledWith('error')).to.be.true;
                expect(stubCallback.called).to.equal(true);
                expect(dbInfoStub.called).to.equal(true);
                done();
            }, 0);
        });

        it('Testcase - store set - insert success - first time rev', function(done) {
            var sessData = {_id: 'sess:key', _rev: 'rev-local', data: 'data'};
            var stubCallback = sinon.spy();
            var sessErr = new Error('404 error');
            sessErr.statusCode = 404;

            dbInfoStub.returns(Promise.resolve({}));
            dbInsertStub.returns(Promise.resolve());
            var store = new CloudantStore(Object.assign({client: client}, goodClientParams));
            var emitSpy = sinon.stub(store, 'emit');
            store.set('key', sessData, stubCallback);
            dbHeadStub.callArgWith(1, sessErr);

            setTimeout(function() {
                expect(emitSpy.calledWith('error')).to.be.false;
                expect(dbInsertStub.calledWith(sinon.match(sessData))).to.equal(true);
                expect(stubCallback.calledWith(null, null)).to.equal(true);
                expect(dbInfoStub.called).to.equal(true);
                expect(sessData._rev).to.equal(undefined);
                done();
            }, 0);
        });

        it('Testcase - store set - insert success - updated rev from database', function(done) {
            var sessData = {_id: 'sess:key', _rev: 'rev-local', data: 'data'};
            var stubCallback = sinon.spy();
            dbInfoStub.returns(Promise.resolve({}));
            dbInsertStub.returns(Promise.resolve());
            var store = new CloudantStore(Object.assign({client: client}, goodClientParams));
            var emitSpy = sinon.stub(store, 'emit');
            store.set('key', sessData, stubCallback);
            dbHeadStub.callArgWith(1, null, null, {etag: '"rev-db-new"'});

            setTimeout(function() {
                expect(emitSpy.calledWith('error')).to.be.false;
                expect(dbInsertStub.calledWith(sinon.match(sessData))).to.equal(true);
                expect(stubCallback.calledWith(null, null)).to.equal(true);
                expect(dbInfoStub.called).to.equal(true);
                expect(sessData._rev).to.equal('rev-db-new');
                done();
            }, 0);
        });

        it('Testcase - store destroy - get error', function(done) {
            var stubCallback = sinon.spy();
            var sessErr = new Error('429 error');
            sessErr.statusCode = 429;
            dbGetStub.returns(Promise.reject(sessErr));
            dbInfoStub.returns(Promise.resolve({}));
            var store = new CloudantStore(Object.assign({client: client}, goodClientParams));
            var emitSpy = sinon.stub(store, 'emit');
            store.destroy('key', stubCallback);

            setTimeout(function() {
                expect(dbGetStub.calledWith('sess:key')).to.be.true;
                expect(dbDestroyStub.called).to.be.false;
                expect(emitSpy.calledWith('error')).to.equal(true);
                done();
            }, 0);
        });

        it('Testcase - store destroy - destory error', function(done) {
            var stubCallback = sinon.spy();
            var sessData = {_id: 'sess:key', _rev: 'rev-local', data: 'data'};
            var sessErr = new Error('429 error');
            sessErr.statusCode = 429;
            dbDestroyStub.returns(Promise.reject(sessErr));
            dbGetStub.returns(Promise.resolve(sessData));
            dbInfoStub.returns(Promise.resolve({}));
            var store = new CloudantStore(Object.assign({client: client}, goodClientParams));
            var emitSpy = sinon.stub(store, 'emit');
            store.destroy('key', stubCallback);

            setTimeout(function() {
                expect(dbGetStub.calledWith('sess:key')).to.be.true;
                expect(dbDestroyStub.called).to.be.true;
                expect(emitSpy.calledWith('error')).to.equal(true);
                done();
            }, 0);
        });

        it('Testcase - store destroy - success', function(done) {
            var stubCallback = sinon.spy();
            var sessData = {_id: 'sess:key', _rev: 'rev-local', data: 'data'};
            dbDestroyStub.returns(Promise.resolve({}));
            dbGetStub.returns(Promise.resolve(sessData));
            dbInfoStub.returns(Promise.resolve({}));
            var store = new CloudantStore(Object.assign({client: client}, goodClientParams));
            var emitSpy = sinon.stub(store, 'emit');
            store.destroy('key', stubCallback);

            setTimeout(function() {
                expect(dbGetStub.calledWith('sess:key')).to.be.true;
                expect(dbDestroyStub.called).to.be.true;
                expect(emitSpy.calledWith('error')).to.equal(false);
                done();
            }, 0);
        });

        it('Testcase - store touch - success', function(done) {
            var stubCallback = sinon.spy();
            var sessData = {_id: 'sess:key', _rev: 'rev-local', data: 'data'};
            var getSessData = Object.assign({}, sessData, {_rev: 'rev-remote-get'});
            dbInsertStub.returns(Promise.resolve({}));
            dbGetStub.returns(Promise.resolve(getSessData));
            dbInfoStub.returns(Promise.resolve({}));
            var store = new CloudantStore(Object.assign({client: client}, goodClientParams));
            var emitSpy = sinon.stub(store, 'emit');
            store.touch('key', sessData, stubCallback);

            setTimeout(function() {
                expect(dbGetStub.calledWith('sess:key')).to.be.true;
                expect(dbInsertStub.called).to.be.true;
                expect(stubCallback.calledWith(null, null)).to.be.true;
                expect(emitSpy.calledWith('error')).to.equal(false);
                expect(sessData._rev).to.equal('rev-remote-get');
                expect(dbInsertStub.calledWith(sinon.match({session_ttl: 2000}))).to.be.true;
                done();
            }, 0);
        });

        it('Testcase - store touch - insert failure', function(done) {
            var stubCallback = sinon.spy();
            var sessData = {_id: 'sess:key', _rev: 'rev-local', data: 'data'};
            var getSessData = Object.assign({}, sessData, {_rev: 'rev-remote-get'});
            var sessErr = new Error('429 error');
            sessErr.statusCode = 429;
            dbInsertStub.returns(Promise.reject(sessErr));
            dbGetStub.returns(Promise.resolve(getSessData));
            dbInfoStub.returns(Promise.resolve({}));
            var store = new CloudantStore(Object.assign({client: client}, goodClientParams));
            var emitSpy = sinon.stub(store, 'emit');
            store.touch('key', sessData, stubCallback);

            setTimeout(function() {
                expect(dbGetStub.calledWith('sess:key')).to.be.true;
                expect(dbInsertStub.called).to.be.true;
                expect(stubCallback.calledWith(sessErr)).to.be.true;
                expect(emitSpy.calledWith('error')).to.equal(true);
                done();
            }, 0);
        });

        it('Testcase - store touch - get failure', function(done) {
            var stubCallback = sinon.spy();
            var sessData = {_id: 'sess:key', _rev: 'rev-local', data: 'data'};
            var sessErr = new Error('429 error');
            sessErr.statusCode = 429;
            dbGetStub.returns(Promise.reject(sessErr));
            dbInfoStub.returns(Promise.resolve({}));
            var store = new CloudantStore(Object.assign({client: client}, goodClientParams));
            var emitSpy = sinon.stub(store, 'emit');
            store.touch('key', sessData, stubCallback);

            setTimeout(function() {
                expect(dbGetStub.calledWith('sess:key')).to.be.true;
                expect(dbInsertStub.called).to.be.false;
                expect(stubCallback.calledWith(sessErr)).to.be.true;
                expect(emitSpy.calledWith('error')).to.equal(true);
                done();
            }, 0);
        });

        it('Testcase - store touch - get failure', function(done) {
            var stubCallback = sinon.spy();
            var sessData = {_id: 'sess:key', _rev: 'rev-local', data: 'data'};
            dbInfoStub.returns(Promise.resolve({}));
            var store = new CloudantStore(Object.assign({client: client}, goodClientParams,
                {disableTTLRefresh: true}));
            store.touch('key', sessData, stubCallback);

            setTimeout(function() {
                expect(dbGetStub.called).to.be.false;
                expect(stubCallback.called).to.be.true;
                done();
            }, 0);
        });
    });
});
