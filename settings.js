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

require('dotenv').load();
module.exports = {
    mongourl: process.env.MONGO || "mongodb://your.url.com:10012",
    debug: false,
    persistentMonitoring : false,
    restServer: {
        port: 8081
    },
    request_size: '10mb',

    amqp_url: process.env.AMQP_URL || "amqp://usr:pw@rabbitmq:5672/",
    amqp_exchange: process.env.AMQP_EXCHANGE || "processmodel",
    amqp_queue: process.env.AMQP_QUEUE || "process-repo",

    perm_url: process.env.PERM_URL || "http://permissionsearch:8080"
};