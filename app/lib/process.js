/*
 *    Copyright 2018 InfAI (CC SES)
 *
 *    Licensed under the Apache License, Version 2.0 (the "License");
 *    you may not use this file except in compliance with the License.
 *    You may obtain a copy of the License at
 *
 *        http://www.apache.org/licenses/LICENSE-2.0
 *
 *    Unless required by applicable law or agreed to in writing, software
 *    distributed under the License is distributed on an "AS IS" BASIS,
 *    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *    See the License for the specific language governing permissions and
 *    limitations under the License.
 */

var express = require('express');
var bson = require('bson').BSONPure;
var db = require('./db');
var settings = require("./../../settings");
var permissions = require('./permissions');
var amqp = require('./event').connect(onAmqpConnected);
var jwt = require('jsonwebtoken');

const os = require('os');
const crypto = require('crypto');

function token(req) {
    var auth = req.get("Authorization");
    var token = auth.replace('Bearer ', '');
    var decoded = jwt.decode(token);
    return decoded;
}

function getUser(req) {
    return token(req).sub
}

var collectionGetter = db.getCollectionGetter("process");

exports.get = function (req, res) {
    var id = req.params.id;
    permissions.check(req, id, "r", function (ok) {
        if (ok) {
            collectionGetter().then(function (collection) {
                collection.find({'_id': new bson.ObjectID(id)}).toArray(function (err, doc) {
                    res.send(doc);
                });
            });
        } else {
            res.status(401).send('access denied');
        }
    })
};

exports.getAllPublished = function (req, res) {

    collectionGetter().then(function (collection) {
        collection.find({'publish': true}).toArray(function (err, doc) {
            if (err) {
                console.log("error while updating", err);
                res.status(500).send({'error': 'An error has occurred'});
            } else {
                res.send(doc);
            }
        });
    });
};

exports.update = function (req, res) {
    console.log("rest update received ", req.params.id);
    var id = req.params.id;
    var process = req.body;
    process._id = id;
    var owner = getUser(req);
    if (!validateProcessModel(process)) {
        res.status(400).send({'error': 'invalid process model'});
        return
    }
    permissions.check(req, id, "w", function (ok) {
        if (ok) {
            collectionGetter().then(function (collection) {
                collection.find({'_id': new bson.ObjectID(id)}).toArray(function (err, doc) {
                    var newProcess = doc[0] || {};
                    for (var key in process) {
                        if (!process.hasOwnProperty(key)) continue;
                        newProcess[key] = process[key];
                    }
                    if (doc.length > 0 && doc[0].owner) {
                        newProcess.owner = doc[0].owner;
                    } else {
                        newProcess.owner = owner;
                    }
                    var err = amqp.put(newProcess, id, owner);
                    if (err) {
                        console.log("error while updating", err);
                        res.status(500).send({'error': 'An error has occurred'});
                    } else {
                        res.send(newProcess);
                    }
                });
            });

        } else {
            res.status(401).send('access denied');
        }
    });
};

exports.publish = function (req, res) {
    console.log("rest publish with description received", req.params.id);
    var id = req.params.id;
    var publish = req.body.publish;
    var owner = getUser(req);
    var description = "";
    if (publish) {
        description = req.body.description;
    }

    permissions.check(req, id, "w", function (ok) {
        if (ok) {
            collectionGetter().then(function (collection) {
                collection.find({'_id': new bson.ObjectID(id)}).toArray(function (err, doc) {
                    var process = doc[0];
                    process._id = id;
                    process.publish = publish;
                    process.publish_date = new Date();
                    process.description = description;
                    var err = amqp.put(process, id, owner);
                    if (err) {
                        console.log("error while updating", err);
                        res.status(500).send({'error': 'An error has occurred'});
                    } else {
                        res.send(process);
                    }
                });
            });

        } else {
            res.status(401).send('access denied');
        }
    });
};


exports.add = function (req, res) {
    console.log("rest add received");
    var process = req.body;
    process._id = objectId();
    if (!validateProcessModel(process)) {
        res.status(400).send({'error': 'invalid process model'});
        return
    }
    var owner = getUser(req);
    process.owner = owner;
    var err = amqp.put(process, process._id, owner);
    if (err) {
        console.log(err);
        res.status(500).send({'error': 'An error has occurred'});
    } else {
        res.send(process);
    }
};

exports.delete = function (req, res) {
    console.log("rest delete received ", req.params.id);
    var id = req.params.id;
    if (!id) {
        res.status(400).send({'error': 'missing id'});
        return
    }
    permissions.check(req, id, "a", function (ok) {
        if (ok) {
            var err = amqp.remove(id);
            if (err) {
                console.log(err);
                res.status(500).send({'error': e});
            } else {
                res.send({'status': 'OK'});
            }
        } else {
            res.status(401).send('access denied');
        }
    });
};

function onAmqpConnected(connection) {
    connection.consume(amqpWorker);
}


function amqpWorker(msg, done) {
    var message = JSON.parse(msg);
    console.log("amqp received");
    if (message.command == "PUT") {
        collectionGetter().then(function (collection) {
            var id = message.id;
            if (message.processmodel._id) {
                delete message.processmodel._id;
            }
            console.log("save process");
            collection.update({'_id': new bson.ObjectID(id)}, message.processmodel, {upsert: true}, function (err, result) {
                done(err);
            });
        });
    } else if (message.command == "DELETE") {
        collectionGetter().then(function (collection) {
            try {
                var id = message.id;
                console.log("delete process", id);
                collection.deleteOne({'_id': new bson.ObjectID(id)});
                done(null);
            } catch (e) {
                done(e);
            }
        });
    } else {
        done("unknown command " + message.command);
    }
}


function objectId() {
    var seconds = Math.floor(new Date() / 1000).toString(16);
    var machineId = crypto.createHash('md5').update(os.hostname()).digest('hex').slice(0, 6);
    var processId = process.pid.toString(16).slice(0, 4).padStart(4, '0');
    var counter = process.hrtime()[1].toString(16).slice(0, 6).padStart(6, '0');
    return seconds + machineId + processId + counter;
}

function validateProcessModel(process) {
    if (!process._id) {
        console.log("validation: missing _id");
        return false
    }
    if (!process.process.definitions.process._id) {
        console.log("validation: missing process id");
        return false
    }
    if (process.owner) {
        console.log("validation: user tries to save ownership");
        return false
    }
    return true
}