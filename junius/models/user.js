var mysql = require ('mysql');
var dbconfig = require ('../config/database');
var connection = mysql.createConnection(dbconfig.connection);
var recombee = require('recombee-api-client');
var rqs = recombee.requests;
var client = new recombee.ApiClient('juniuscsc-dev', 'Z4FehNtYFhy2zVTcDC8Yf2qf2tNscbQ64qyYVdmr1DQm3yIUjEmpWY3JFNXFR0jq');


const User = {
    findOrCreateGoogle: function(email, callback){
        connection.query("SELECT * FROM stripecsc.users WHERE method = ? AND username = ?",["google",email], function(error,results){
            if(results.length == 0){
                connection.query("INSERT INTO stripecsc.users (username,joindate,method) VALUES (?,NOW(),?)",[email,"google"]);
                connection.query("SELECT * FROM stripecsc.users WHERE username = ?",[email], function(error2,results2){
                    client.send(new rqs.AddUser(results2[0].id));
                    return callback(results2[0]);
                })
            }
            else return callback(results[0]);
        })
    },
    Upgrade: function(email, callback){
        connection.query("UPDATE stripecsc.users SET role = 1 WHERE username = ?",[email], function(error){
            //console.log(error);
            if(error) return callback('Unable to upgrade account. Please contact an Administrator.');
            else return callback(null);
        })
    },
    updateCustomerID: function(email, id, callback){
        connection.query("UPDATE stripecsc.users SET customerID = ? WHERE username = ?",[id,email], function(error){
            if(error) return callback(error);
            else return callback(null);
        })
    },
    updateSubscriptionID: function(customerID, subscriptionID, callback){
        connection.query("UPDATE stripecsc.users SET subscriptionID = ? WHERE customerID = ?",[subscriptionID,customerID], function(error){
            if(error) return callback(error);
            else return callback(null);
        })
    },
    removeSubscriptionID: function(customerID, callback){
        connection.query("UPDATE stripecsc.users SET subscriptionID = NULL WHERE customerID = ?",[customerID], function(error){
            if(error) return callback(error);
            else return callback(null);
        })
    },
    Demote: function(email, callback){
        connection.query("UPDATE stripecsc.users SET role = 0 WHERE username = ?",[email], function(error){
            if(error) return callback(error);
            else return callback(null);
        })
    },
    demotebyCustomerID: function(customerID, callback){
        connection.query("UPDATE stripecsc.users SET role = 0 WHERE customerID - ?",[customerID], function(error){
            if(error) return callback(error);
            else return callback(null);
        })
    },
    getAll: function(callback){
        connection.query("SELECT id, username, joindate FROM stripecsc.users", function(error,results){
            if(error || results.length == 0) return callback(null);
            else return callback(convertUsernametoEmail(results));
        })
    },
    getByID: function(id, callback){
        connection.query("SELECT id, username, joindate FROM stripecsc.users WHERE id = ? LIMIT 1", [id], function(error,results){
            if(error || results.length == 0) return callback(null);
            else return callback(convertUsernametoEmailSingleRow(results[0]));
        })
    },
    getByEmail: function(email, callback){
        connection.query("SELECT id, username, joindate FROM stripecsc.users WHERE username = ? LIMIT 1",[email], function(error,results){
            if(error || results.length == 0) return callback(null);
            else return callback(convertUsernametoEmailSingleRow(results[0]));
        })
    }
}

module.exports = User;

function convertUsernametoEmail(data){
    var array = [];
    data.forEach(user=>{
        var input = {
            id: user.id,
            email: user.username,
            joindate: user.joindate
        }
        array.push(input);
    })
    return array;
}

function convertUsernametoEmailSingleRow(user){
    var input = {
        id: user.id,
        email: user.username,
        joindate: user.joindate
    }
    return input;
}