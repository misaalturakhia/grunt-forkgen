var async = require('async');
var path = require('path');
var fs = require('fs');
var fse = require('fs-extra');
var pluralize = require('pluralize');

var options = {
    path : '',
    client : false, // todo : add support for client
    server : {
        api : ['lists','campaigns'], // expects stuff like 'lists', 'companies' etc 
        mongoose : true, // false by default
        appRequire : true,
        crossorigin : false, 
    }      
};

var isAppRequire = false;
var appRequireStr;

module.exports = function(grunt){
    
    grunt.registerMultiTask('forkgen', 'Generating folder structure', function(){
        var params = this.data || {};        
        var projectPath = params.path ? params.path : process.cwd(); //  TODO : CHECK
        
        // code for generating client
        if(params.client){
            // todo :
        }
        // code for generating server
        if(params.server){
            isAppRequire = params.server.appRequire || false;
            var serverPath = path.join(projectPath, 'server');
            var apiNames = params.server.api || [];
            async.parallel([
                // for each api name create its api/index.js and the controller in parallel execution
                function (cb){
                    async.each(apiNames, function(apiName, eachCb){
                        async.parallel(
                            [
                                // create the api/apiName/index.js file
                                function(callback){
                                    // construct the path of the api/index.js file
                                    var filePath = path.join(serverPath, 'api', apiName, 'index.js');
                                    appendToAppRequireStr('api.' + apiName, filePath);                                    
                                    ensureAndWrite(filePath, getIndexJsContent(apiName), callback);                                                           
                                },
                                // create the controller file at /server/controllers/apiName/
                                function(callback){
                                    // construct the path for the controller file
                                    var filePath = path.join(serverPath, 'controllers', apiName, apiName + '.controller.js');
                                    appendToAppRequireStr('controller.' + apiName, filePath);
                                    ensureAndWrite(filePath, getControllerContent(apiName), callback);                            
                                },
                                // create the model file if required
                                function(callback){
                                    if(!params.server.mongoose){
                                        return callback(null);
                                    }
                                    var singular = pluralize(apiName, 1);
                                    var filePath = path.join(serverPath, 'models', singular + '.model.js');
                                    appendToAppRequireStr('model.' + singular, filePath);
                                    ensureAndWrite(filePath, getModelContent(singular), callback);
                                }                            
                            ],
                            function(err){
                                return eachCb(err);
                            }
                        );                                        
                    },
                    // after each apiName has had its files created
                    function(err){
                        return cb(err);
                    });
                },
                // create app.js
                function(cb){
                    var filePath = path.join(serverPath, 'app.js');
                    ensureAndWrite(filePath, getAppJsContent(params.server), cb); 
                },
                // create route.js
                function(cb){
                    var filePath = path.join(serverPath, 'route.js');
                    ensureAndWrite(filePath, getRouteJsContent(), cb); 
                },
                // create utils folder.
                function(cb){
                    var dirPath = path.join(serverPath, 'utils');
                    fse.ensureDir(dirPath, cb);
                }                
            ], function(err){
                if(err){
                    console.log('something went wrong in project structure generation');
                    return console.log(err);
                }
                if(params.server.appRequire){
                    var filePath = path.join(serverPath, 'require-config.js');                    
                    ensureAndWrite(filePath, getAppRequireContent(), function(err){
                        if(err){
                            console.log('Something went wrong in writing the appRequire file');
                            console.log(err);
                        }else{
                            console.log('Success! FOLDER STRUCTURE CREATED!');
                        } 
                    });
                }
            });                          
        }                             
    });      
};

/**
 * Ensure that the file exists and write the input content to it
 */
function ensureAndWrite(filePath, content, cb){
    fse.ensureFile(filePath, function(err){
        if(err){
            return cb(err);
        }
        // write the required content to the file
        fs.writeFile(filePath, content, function(err){
            if(err){
                return cb(err);
            }
            return cb(null);
        });                                
    });
}

function getControllerPath(apiName){
    if(isAppRequire){
        return "appRequire('controller.'"+apiName+")";
    }else{
        return "require('../../controllers/'"+apiName+"/"+apiName+".controller')";
    }
}

/**
 * 
 */
function getIndexJsContent(apiName){    
    return
          "var express = require('express');\n"
        + "var Router = express.Router();\n\n"
        + "var Controller = "+getControllerPath(apiName)+"; // todo : CHECK CONTROLLER PATH!!\n\n"
        + "Router.post('/', Controller.create);\n"
        + "Router.get('/', Controller.listAll);\n"
        + "Router.get('/:id', Controller.listOne);\n"
        + "Router.put('/:id', Controller.updateOne);\n"
        + "Router.delete('/', Controller.remove);\n\n"
        + "module.exports = Router;\n";    
}

/**
 * 
 */
function getControllerContent(apiName){
    return 
          "module.exports = {\n\n"
        + "\tcreate : create,\n"
        + "\tlistAll : listAll,\n"
        + "\tlistOne : listOne,\n"
        + "\tupdateOne : updateOne,\n"
        + "\tremove : remove \n\n"
        + "};\n\n"
        + "function create(req, res){\n"
        + "\t//todo : \n"
        + "}\n\n"
        + "function listAll(req, res){\n"
        + "\t//todo : \n"
        + "}\n\n"
        + "function listOne(req, res){\n"
        + "\t//todo : \n"
        + "}\n\n"
        + "function updateOne(req, res){\n"
        + "\t//todo : \n"
        + "}\n\n"
        + "function remove(req, res){\n"
        + "\t//todo : \n"
        + "}\n\n";
}

/**
 * 
 */
function getRouteJsContent(apiNames){
    var apiStrings = '';
    for(var i = 0; i < apiNames.length; i++){
        var apiName = apiNames[i];
        apiStrings += "\tapp.use('/api/'"+apiName+", "+getControllerPath(apiName)+");\n";
    }
    var content = 
          "module.exports = function(app){"
        + apiStrings
        + "\n"
        + "};\n\n";        
    return content;
}

/**
 * 
 */
function getAppJsContent(serverParams){
    function getCrossOriginString(){
        if(serverParams.crossorigin){            
            return 
                + "app.use(function(req, res, next){"
                + "\tres.header('Access-Control-Allow-Origin', '*');"
                + "\tres.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');"
                + "\tnext();"
                + "});\n\n"
        }else{
            return "\n";
        }
    }
    var content =
        + "var http = require('http');"    
        + "var express = require('express');\n"
        + "var app = express();\n\n"
        + "var port = 5000 // todo : replace \n"
        + "var host = 'http://www.google.com'; // todo : replace"
        + getCrossOriginString();
        + "require('./route')(app);\n\n"
        + "var server = http.createServer(app);\n\n"
        + "server.listen(port, host, function(){\n"
        + "\tvar startStr = 'Email Server started at PORT ' + port + ' on ' + host;\n"
        + "\tconsole.log(startStr);\n"
        + "});\n\n"
        + "process.on('SIGTERM', function(){\n"
        + "\tconsole.log('exiting');\n"
        + "\tprocess.exit(0);\n"
        + "});\n"
    return content;
}

/**
 * 
 */
function getModelContent(apiName){    
    var schemaName = apiName + 'Schema';
    var content = 
        + "var mongoose = require('mongoose');\n"
        + "var Schema = mongoose.Schema;\n\n"
        + "var collectionName = ''; //todo : enter collection name\n"
        + "var "+schemaName+" = new Schema({\n\n"
        + "\t// todo : add schema structure"
        + "});\n"
        + "module.exports = mongoose.model(collectionName, "+schemaName+")\n";
    return content;
}

// process.on('SIGTERM',function(){
// 	LogUtils.logError({error : 'server is shutting down'});
// 	console.log("Exiting");
// 	process.exit(0);
// });

function appendToAppRequireStr(alias, filePath){
    if(isAppRequire){
        appRequireStr += "\t" + alias + " : " + filePath + ",\n" ;        
    }
}

function getAppRequireContent(){
    if(!isAppRequire){
        return "";
    }    
    return 
        + "module.exports = {"
        + appRequireStr
        + "};";        
}