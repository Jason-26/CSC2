var mysql = require ('mysql');
var dbconfig = require ('../config/database');
var connection = mysql.createConnection(dbconfig.connection);
var recombee = require('recombee-api-client');
var rqs = recombee.requests;
var client = new recombee.ApiClient('juniuscsc-dev', 'Z4FehNtYFhy2zVTcDC8Yf2qf2tNscbQ64qyYVdmr1DQm3yIUjEmpWY3JFNXFR0jq');

const Picture = {
    Add: function(userID, image, desc, fileName, callback){
        var date = new Date();
        var insertQuery = 
        "INSERT INTO stripecsc.pictures (userID, url, dateTime, description, fileName) VALUES (?, ?, ?, ?, ?)"
        connection.query(insertQuery,
            [userID, image, date, desc, fileName],
            function(error, results){
                if(error) return callback("Unable to add picture to our database. Please contact Administrator.", null);
                else return callback("Image was successfully added", results.insertId); 
            });
    },
    displayRecommendations: function(IDs, callback){
        var query = "SELECT * FROM stripecsc.picturesview";
        for(var i = 0; i < IDs.length; i++){
            if(i == 0) query += " WHERE"
            query += " id = " + IDs[i];
            if(IDs.length-1 != i) query += " OR";
        }
        query += " LIMIT 4;";
        connection.query(query,function(error,results){
            console.log(error)
            if(error) return callback(null);
            else return callback(results);
        });
    },
    getAll: function(callback){
        var query = "SELECT * FROM stripecsc.picturesview";
        connection.query(query, function(error, results){
            if(error) return callback(null);
            else return callback(results);
        })
    },
    getUserData: function(username, callback){
        var query = "SELECT * FROM stripecsc.picturesview WHERE username = ?";
        connection.query(query,[username],function(error, results){
            if(error || results.length == 0) return callback(null);
            else return callback(results);
        })
    },
    getUserDataByID: function(id, callback){
        var query = "SELECT * FROM stripecsc.picturesview WHERE userID = ?";
        connection.query(query,[id],function(error, results){
            if(error || results.length == 0) return callback(null);
            else return callback(results);
        }) 
    },
    get: function(id, callback){
        var query = "SELECT * FROM stripecsc.picturesview WHERE id = ? LIMIT 1";
        connection.query(query,[id],function(error,results){
            if(error || results.length == 0) return callback(null);
            else return callback(results[0]);
        })
    },
    updateDescription: function(userID, id, desc, callback){
        connection.query("SELECT id, url, description FROM stripecsc.picturesview WHERE id = ? AND userID = ? LIMIT 1", [id, userID], function(error,results){
            if(error || results.length == 0) return callback("ERROR");
            else{
                connection.query("UPDATE stripecsc.pictures SET description = ? WHERE id = ?",[desc, id], function(error2){
                    if(error2) return callback("ERROR");
                    else {
                        client.send(new rqs.DeleteItem(results[0].id));
                        sendItem(results[0].id,desc,results[0].url);
                        return callback(null);
                    }
                })
            }
        })
    },
    Delete: function(userID, id, callback){
        connection.query("SELECT fileName FROM stripecsc.picturesview WHERE id = ? AND userID = ? LIMIT 1", [id, userID], function(error,results){
            console.log(error);
            if(error || results.length == 0) return callback(null);
            else{
                connection.query("DELETE FROM stripecsc.pictures WHERE id = ?",[id],function(error2){
                    console.log(error2);
                    if(error2) return callback(null);
                    else return callback(results[0].fileName);
                })
            }
        })
    }
}

module.exports = Picture;

function sendItem(id, description, url){
    client.send(new rqs.Batch([
      new rqs.AddItemProperty('description', 'string'),
      new rqs.AddItemProperty('url', 'string'),
    ]))
    .then((responses) => {
      var requests = [];
      var input = new rqs.SetItemValues(
        id,
        {
          description: description,
          url: url
        },
        {
          cascadeCreate: true
        }
      );
      requests.push(input);
      client.send(new rqs.Batch(requests));
    })
  }