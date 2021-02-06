var LocalStrategy = require("passport-local").Strategy;
var GoogleStrategy = require('passport-google-oauth20').Strategy;

var mysql = require('mysql');
var bcrypt = require('bcryptjs');
var dbconfig = require('./database');
var Users = require("../models/user");
var connection = mysql.createConnection(dbconfig.connection);
var recombee = require('recombee-api-client');
var rqs = recombee.requests;
var client = new recombee.ApiClient('juniuscsc-dev', 'Z4FehNtYFhy2zVTcDC8Yf2qf2tNscbQ64qyYVdmr1DQm3yIUjEmpWY3JFNXFR0jq');
var saltRounds = 10;

connection.query('USE ' + dbconfig.database);

module.exports = function(passport) {
 passport.serializeUser(function(user, done){
  done(null, user.id);
 });

 passport.deserializeUser(function(id, done){
  connection.query("SELECT * FROM users WHERE id = ? ", [id],
   function(err, rows){
    done(err, rows[0]);
   });
 });
 
//  passport.use('google', new GoogleStrategy({
//   clientID: "",
//   clientSecret: "",
//   callbackURL: "http://juniuscsc.ml/googleAuthenticated"
// },
// function(accessToken, refreshToken, profile, done) {
//   Users.findOrCreateGoogle(profile.emails[0].value,(profileData)=>{
//     console.log(profileData)
//     return done(null,profileData);
//   })
// }
// ));

 passport.use(
  'local-signup',
  new LocalStrategy({
   usernameField : 'username',
   passwordField: 'password',
   passReqToCallback: true
  },
  function(req, username, password, done){
   connection.query("SELECT * FROM users WHERE username = ? ", 
   [username], function(err, rows){
    if(err)
     return done(err);
    if(rows.length){
     return done(null, false, req.flash('signupMessage', 'That is already taken'));
    }else{
    const salt = bcrypt.genSaltSync(saltRounds);
     var newUserMysql = {
      username: username,
      password: bcrypt.hashSync(password, salt),
      date : new Date()
     };

     var insertQuery = "INSERT INTO users (username, password, joindate) values (?, ?, ?)";

     connection.query(insertQuery, [newUserMysql.username, newUserMysql.password, newUserMysql.date],
      function(err, rows){
       newUserMysql.id = rows.insertId;
       client.send(new rqs.AddUser(rows.insertId));
       return done(null, newUserMysql);
      });
    }
   });
  })
 );

 
 passport.use(
  'local-login',
  new LocalStrategy({
   usernameField : 'username',
   passwordField: 'password',
   passReqToCallback: true
  },
  function(req, username, password, done){
   connection.query("SELECT * FROM users WHERE username = ? ", [username],
   function(err, rows){
    if(err)
     return done(err);
    if(!rows.length){
     return done(null, false, req.flash('loginMessage', 'No User Found'));
    }
    console.log(password)
    console.log(rows[0].password);
    if(!bcrypt.compareSync(password, rows[0].password))
     return done(null, false, req.flash('loginMessage', 'Wrong Password'));

    return done(null, rows[0]);
   });
  })
 );
};