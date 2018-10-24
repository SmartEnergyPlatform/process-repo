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

var http = require('http');
var settings = require("./../../settings");
var url = require('url');

module.exports = {
    check: function(req, id, rights, callback){
        var options = url.parse(settings.perm_url+"/jwt/check/"+encodeURIComponent(settings.amqp_exchange)+"/"+encodeURIComponent(id)+"/"+rights);
        options.method = 'GET';
        options.headers  = {
            accept: 'application/json',
            Authorization: req.get("Authorization") || "foo"
        };
        var x = http.request(options,function(res){
            if(res.statusCode != 200){
                callback(false)
            }else{
                callback(true)
            }
        });
        x.end();
    }
};

