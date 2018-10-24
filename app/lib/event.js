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

var amqp = require('amqplib/callback_api');
var settings = require("./../../settings");



module.exports = {
    connect: function (then) {
        var connection = {};
        //true, false, false, false
        amqp.connect(settings.amqp_url, function(err, conn) {
            if(err){
                console.log(err);
                process.exit(err);
            }

            conn.on("error", function(err) {
                if (err.message !== "Connection closing") {
                    console.error("amqp conn error", err.message);
                }
            });
            conn.on("close", function() {
                console.error("amqp connection lost");
                process.exit("amqp connection lost");
            });

            conn.createChannel(function(err, ch) {
                var ex = settings.amqp_exchange;
                ch.assertExchange(ex, 'fanout', {durable: true});

                connection.produce = function(msg){
                    var message = JSON.stringify(msg);
                    console.log("amqp produce: ", message);
                    ch.publish(ex, '', new Buffer(message));
                };

                connection.put = function(element, id, owner){
                    try{
                        connection.produce({command: "PUT", processmodel: element, id: id, owner: owner})
                    }catch(err){
                        return err
                    }
                };

                connection.remove = function(id){
                    try{
                        connection.produce({command: "DELETE", id: id})
                    }catch(err){
                        return err
                    }
                };

                connection.consume = function(worker){
                    console.log("start consumer");
                    ch.assertQueue(settings.amqp_queue, {exclusive: false}, function(err, q) {
                        ch.bindQueue(q.queue, ex, '');
                        ch.prefetch(1);
                        ch.consume(q.queue, function(msg) {
                            if(!msg){
                                console.log("fatal amqp error");
                                process.exit("fatal amqp error");
                            }
                            console.log("call worker to consume msg");
                            worker(msg.content.toString(), function(err){
                                if(err){
                                    console.log("amqp worker error", err);
                                    ch.nack(msg)
                                }else{
                                    ch.ack(msg);
                                }
                            });
                        }, {noAck: false}, function(err, ok){
                            if(err){
                                console.log("amqp consumer error", JSON.stringify(err));
                                process.exit("fatal amqp error: "+ JSON.stringify(err));
                            }
                        });
                    });
                };

                if(then){
                    then(connection);
                }
            });
        });
        return connection;
    }
};