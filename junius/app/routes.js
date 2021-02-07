var stripe = require("stripe")("sk_test_51I7DtPHYIP97JskRVxJcP6kCS55nnR1QxUxoOkQo2K1fFVDXD639AuBHZALu3NB6C9ij7DpPDp8OuO1Od8kxYMuc00dGbqRbt4");
var bodyParser = require('body-parser');
var Valid = require("../models/valid");
const multer = require ('multer');
const AWS = require ('aws-sdk');
const dynamoAWS = require ('aws-sdk');
const { v4: uuid } = require('uuid');
const Picture = require("../models/Picture");
const User = require("../models/user");
const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');
var recombee = require('recombee-api-client');
var rqs = recombee.requests;
var client = new recombee.ApiClient('juniuscsc-dev', 'Z4FehNtYFhy2zVTcDC8Yf2qf2tNscbQ64qyYVdmr1DQm3yIUjEmpWY3JFNXFR0jq');
 
const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);
 
const s3 = new AWS.S3 ({
  accessKeyId: '',
  secretAccessKey: '',
});

let awsConfig = {
  "region": "ap-southeast-1",
  "endpoint": "http://dynamodb.ap-southeast-1.amazonaws.com",
  accessKeyId: '',
  secretAccessKey: '',
};
dynamoAWS.config.update(awsConfig);


const scopes = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar'
];

module.exports = function (app, passport) {
  app.post('/googleLogin', passport.authenticate('google', {
    scope: [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email'
      ]    
}));

// callback route for google to redirect to
// hand control to passport to use code to grab profile info
app.get('/googleAuthenticated', passport.authenticate('google'), (req, res) => {
    res.redirect('/');
});
const storage = multer.memoryStorage ({
  destination: function (req, file, callback) {
    callback (null, '');
  },
});

app.use(multer({storage}).single('image'));


  app.use(bodyParser.urlencoded({
    extended: true
   }));

  app.get('/reco', function(req,res){
    client.send(new rqs.Batch([
      new rqs.AddItemProperty('description', 'string'),
      new rqs.AddItemProperty('url', 'string'),
    ]))
    .then((responses) => {
      Picture.getAll((pictures)=>{
        var requests = [];
        pictures.forEach(picture =>{
          var input = new rqs.SetItemValues(
            picture.id,
            {
              description: picture.description,
              url: picture.url
            },
            {
              cascadeCreate: true
            }
          );
          requests.push(input);
        })
        //Send catalog to the recommender system
        client.send(new rqs.Batch(requests));
      })
    })
    res.send("DONE");
  })

  app.get('/red', function(req,res){
    dynamoAWS.config.update(awsConfig);
    let docClient = new AWS.DynamoDB.DocumentClient();
    var params = {
      TableName: "viewedImages",
  };
  docClient.scan(params, function (err, data) {
      if (err) {
        console.log(err);
      }
      else {
        var request = []
        var viewedData = data.Items;
        viewedData.forEach(item=>{
          request.push(new rqs.AddDetailView(item.userID, item.imageID, {'cascadeCreate': true}))
        })
        client.send(new rqs.Batch(request))
      }
  })
    res.send("more stuff done");
  })

  app.get('/talents', function(req,res){
    User.getAll((users)=>{
      if(users){
        res.render ('talents.ejs', {
          talents:users,
          user: req.user,
          message: null,
          paymentMade: null
        });
      } else renderError(res);
    })
  })

  app.get ('/', function (req, res) {
    if(req.isAuthenticated()){
      client.send(new rqs.RecommendItemsToUser(req.user.id, 4))
      .then((recommended) => {
        var IDs = [];
        recommended.recomms.forEach(item=>{
          IDs.push(item.id)
        })
        Picture.displayRecommendations(IDs,(pictures)=>{
          if(pictures){
            var msg = null;
            var paymentMade = null;
            if(req.query.msg) msg = DOMPurify.sanitize(req.query.msg);
            if(req.query.paymentMade && req.query.paymentMade == "yes") paymentMade = req.query.paymentMade;
            res.render ('index.ejs', {
              pictures:pictures,
              user: req.user,
              message: msg,
              paymentMade: paymentMade
            });
          }
          else renderError(res);
        });
      });
    } else{
      Picture.getAll((pictures)=>{
        if(pictures){
          var msg = null;
          if(req.query.msg) msg = DOMPurify.sanitize(req.query.msg);
          res.render ('index.ejs', {
            pictures:pictures,
            user: req.user,
            message: msg,
            paymentMade: null
          });
        }
        else renderError(res);
      })
    }
  });

  app.get('/login', function(req,res){
    if(req.isAuthenticated()) res.redirect('/');
    else res.render ('login.ejs', {message: req.flash ('loginMessage')});
  })

  app.post (
    '/login',
    passport.authenticate ('local-login', {
      successRedirect: '/',
      failureRedirect: '/',
      failureFlash: true,
    }),
    function (req, res) {
      if (req.body.remember) {
        req.session.cookie.maxAge = 1000 * 60 * 3;
      } else {
        req.session.cookie.expires = false;
      }
      res.redirect ('/');
    }
  );
  

  //signup route get method
  app.get ('/signup', function (req, res) {
    res.render ('signup.ejs', {message: req.flash ('signupMessage')});
  });

  app.get('/profile', function(req,res){
    if(req.query.name){
      Picture.getUserData(DOMPurify.sanitize(req.query.name), (pictures)=>{
          res.render ('profile.ejs', {
            username: req.query.name,
            pictures:pictures,
            user: req.user,
            message: null,
            paymentMade: null
          });
      })
    }
    else renderError(res);
  })

  app.get('/image', function(req,res){
    if(req.query.id){
      Picture.get(DOMPurify.sanitize(req.query.id), (picture)=>{
        if(picture){
          if(req.user){
            dynamoAWS.config.update(awsConfig);
            let docClient = new dynamoAWS.DynamoDB.DocumentClient();
            var input={
              id: uuid (),
              userID: req.user.id,
              imageID: DOMPurify.sanitize(req.query.id),
            }
            var params = {
              TableName: "viewedImages",
              Item:  input
            };
            docClient.put(params, function (err, data) {
          });
          sendViewedData(req.user.id,req.query.id);
          }
          var msg = null;
          if(req.query.msg) msg = DOMPurify.sanitize(req.query.msg);
          res.render ('image.ejs', {
            picture:picture,
            user: req.user,
            message: msg,
            paymentMade: null
          });
        }
        else renderError(res);
      })
    }
    else renderError(res);
  })

  app.get('/upload', isLoggedIn, function(req,res){
    var msg = null;
    if(req.query.msg) msg = DOMPurify.sanitize(req.query.msg);
    res.render('upload.ejs',{
      user: req.user,
      message:msg,
      paymentMade: null
    })
  })

  app.get('/payment' ,isLoggedIn, isFreeUser, function(req,res){
    var msg = null;
    if(req.query.msg) msg = DOMPurify.sanitize(req.query.msg);
    res.render('payment.ejs',{
      user: req.user,
      message:msg,
      paymentMade: null
    })
  })

  app.post('/api/deleteImage', isLoggedIn, function(req,res){
    if(req.query.id){
      Picture.Delete(req.user.id, DOMPurify.sanitize(req.query.id), (fileName)=>{
        if(!fileName) res.redirect("/image?msg=Unable to delete this image. Please contact an administrator for assistance!&id=" + req.query.id);
        else {
          var deleteParams = {  Bucket: 'talentca2', Key: fileName};
          AWS.config.update({
            region: "ap-southeast-1",
            s3BucketEndpoint: false,
            endpoint: "https://s3.amazonaws.com",
            force_destroy: true
          })
          s3.deleteObject(deleteParams, function(err, data) {
            console.log(err);
            console.log(data);
          });
          client.send(new rqs.DeleteItem(req.query.id));
          res.redirect("/?msg=Image deleted successfully!")
        }
      })
    }
    else renderError(res);
  })

  app.post('/api/updateDescription',isLoggedIn, function(req,res){
    if(!req.body.id) renderError(res);
    else if(!req.body.description) res.redirect('/image?id=' + id + "&msg=Input field cannot be empty!");
    else{
      Picture.updateDescription(req.user.id, DOMPurify.sanitize(req.body.id), DOMPurify.sanitize(req.body.description), (error)=>{
        if(error) res.redirect('/image?id=' + req.body.id + "&msg=Unable to update image description");
        else res.redirect('/image?id=' + req.body.id + "&msg=Image description updated successfully");
      })
    }
  })

  app.post('/api/upload', isLoggedIn, function(req,res) {
    let myFile = req.file.originalname.split ('.');
    const fileType = myFile[myFile.length - 1];

    if (!myFile) res.redirect('/upload?msg=No image selected');
    else if (myFile[1] != 'jpeg' && myFile[1] != 'jpg' && myFile[1] != 'png') res.redirect('/upload?msg=Incorrect File Format');
    else {
      var imageKey = `${uuid ()}.${fileType}`;
      const params = {
        Bucket: 'talentca2',
        Key: imageKey,
        Body: req.file.buffer,
      };
      //Uploading file to S3 Object
      AWS.config.update({
        region: "ap-southeast-1",
        s3BucketEndpoint: false,
        endpoint: "https://s3.amazonaws.com"
      })
      s3.upload (params, (err, data) => {
        console.log(err);
        if (err) res.redirect('/upload?msg=Error in uploading file to S3 Bucket');
        else {
          Picture.Add(req.user.id, data.Location, DOMPurify.sanitize(req.body.description), imageKey, (msg, newPictureID) => {
            sendItem(newPictureID,req.body.description,data.Location);
            res.redirect('/upload?msg=' + msg);
          })
        }
      });
    }
  })



  //signup route post method
  app.post (
    '/signup',
    passport.authenticate ('local-signup', {
      successRedirect: '/',
      failureRedirect: '/signup',
      failureFlash: true,
    })
  );

  //Logout Route
  app.get ('/logout', isLoggedIn, function (req, res) {
    req.logOut ();
    req.session.destroy (function (err) {
      res.redirect ('/');
    });
  });

  app.post ('/create-session', isLoggedIn, (req, res) => {
    createSession(res,"price_1IGg7zHYIP97JskRUZsncEXk", req.user.username);
   });

   app.post('/cancelSubscription', isLoggedIn, isPaidUser, (req,res)=>{
    stripe.subscriptions.del(
      req.user.subscriptionID,
      function(err, confirmation) {
        if(err) res.redirect('/?msg=Unable to Cancel Subscription');
        else {
          User.Demote(req.user.username,(error=>{
            if(error) res.redirect('/?msg=Unable to update user role');
            else res.redirect('/?msg=Subscription Canceled')
          }))
        }
      }
    );
   })
  
   app.get('/api/getUserImages', function(req,res){
     if(req.body.email && req.body.userID){
      res.json({message: "Please submit either a email or ID to this API"}).send();
     }
     else if(req.body.email){
      if(Valid.Email(req.body.email)){
        Picture.getUserData(req.body.email,(pictures)=>{
          if(pictures) res.json(pictures).send();
          else res.json({message: "There seems to be no images associated with this email"}).send();
        })
      } else res.json({message: "Invalid Email"}).send();
     } else if(req.body.userID){
        if(Valid.ID(req.body.userID)){
          Picture.getUserDataByID(req.body.userID,(pictures)=>{
            if(pictures) res.json(pictures).send();
            else res.json({message: "There seems to be no images associated with this userID"}).send();
          })
        } else res.json({message: "Invalid ID"}).send();
     } else{
       Picture.getAll((pictures)=>{
         if(pictures) res.json(pictures).send();
         else res.json({message: "Something seems to have gone wrong"}).send();
       })
     }
   })

   app.get('/api/getImageData',function(req,res){
     if(req.body.id){
      if(Valid.ID(req.body.id)){
        Picture.get(req.body.id,(picture)=>{
          if(picture) res.json(picture).send();
          else res.json({message: "There seems to be no images associated with this ID"}).send();
        })
      } else res.json({message: "Invalid ID"}).send();
     }
     else res.json({message: "Please submit an ID to this API"}).send();
   })

   app.get('/api/getTalentsData', function(req,res){
     if(req.body.id && req.body.email){
      res.json({message: "Please submit either a email or ID to this API"}).send();
     } else if(req.body.id){
        if(Valid.ID(req.body.id)){
          User.getByID(req.body.id,(user)=>{
            if(user) res.json(user).send();
             else res.json({message: "There seems to be no users associated with this ID"}).send();
          })
        } else res.json({message: "Invalid ID"}).send();
     } else if(req.body.email){
        if(Valid.Email(req.body.email)){
          User.getByEmail(req.body.email,(user)=>{
            if(user) res.json(user).send();
            else res.json({message: "There seems to be no users associated with this email"}).send();
          })
        } else res.json({message: "Invalid Email"}).send();
     } else{
       User.getAll((users)=>{
         if(users) res.json(users).send();
         else res.json({message: "Something seems to have gone wrong"}).send();
       })
     }
   })
  
  app.post('/webhooks', bodyParser.raw({type: 'application/json'}), (request, response) => {
    let event;
  
    try {
      event = JSON.parse(request.body);
    } catch (err) {
      response.status(400).send(`Webhook Error: ${err.message}`);
    }
  
  
    // Handle the event
    switch (event.type) {
      case 'payment_method.attached':
        const paymentMethod = event.data.object.billing_details.email;
        console.log('PaymentMethod was attached to a Customer!');
        break;
      case 'customer.created':
        var data = event.data.object;
        User.updateCustomerID(DOMPurify.sanitize(data.email), DOMPurify.sanitize(data.id), (error)=>{
          if(error) response.status(500).send();
          else response.status(200).send();
        })
        break;
      case 'invoice.paid':
        const invoiceData = event.data.object;
        User.Upgrade(invoiceData.customer_email,(error)=>{
          console.log(error);
          if(error) response.status(500).send();
          else{
            dynamoAWS.config.update(awsConfig);
        let docClient = new dynamoAWS.DynamoDB.DocumentClient();
        var input={
          paymentID: uuid (),
          customerID: DOMPurify.sanitize(invoiceData.customer),
          type: "payment",
          amount: DOMPurify.sanitize(invoiceData.amount)
        }
        var params = {
          TableName: "payments",
          Item:  input
        };
        docClient.put(params, function (err, data) {
          console.log(data);
          console.log(err);

          if (err) {
            response.status(500).send();                    
          } else {
            response.status(200).send();;                      
          }
      });
          }
        })
        break;
      case 'customer.subscription.created':
        const subscriptionData = event.data.object;
        User.updateSubscriptionID(DOMPurify.sanitize(subscriptionData.customer),DOMPurify.sanitize(subscriptionData.id),(error)=>{
          if(error) response.status(500).send();
          else response.status(200).send();
        })
        break;
      case 'charge.refunded':
        const refundData = event.data.object;
        dynamoAWS.config.update(awsConfig);
        let docClient2 = new dynamoAWS.DynamoDB.DocumentClient();
        var input={
          paymentID: uuid (),
          customerID: DOMPurify.sanitize(refundData.customer),
          type: "refund",
          amount: DOMPurify.sanitize(refundData.amount_refunded)
        }
        var params = {
          TableName: "payments",
          Item:  input
        };
        docClient2.put(params, function (err, data) {
          console.log(data);
          console.log(err);

          if (err) {
            response.status(500).send();                    
          } else {
            response.status(200).send();;                      
          }
      });
        break; 
      case'customer.subscription.deleted':
        const customerData = event.data.object;
        User.removeSubscriptionID(DOMPurify.sanitize(customerData.customer),(error)=>{
          if(error) response.status(500).send();
          else response.status(200).send();
        })
        break;
      case 'invoice.payment_failed':
        const failedData = event.data.object;
        User.demotebyCustomerID(failedData.customer,(error)=>{
          if(error) response.status(500).send();
          else response.status(200).send();
        })
      default:
        // Unexpected event type
        return response.status(400).end();
    }
  
    // Return a 200 response to acknowledge receipt of the event
    response.json({received: true});
  });

  
};

//Check if is a free uyser
function isFreeUser(req,res,next){
  if(req.user.role == 0) return next();
  else res.redirect('/');
}

//Check if is a paid user
function isPaidUser(req,res,next){
  if(req.user.role == 1) return next();
  else res.redirect('/');
}

//Check if user is logged in
function isLoggedIn (req, res, next) {
  if (req.isAuthenticated ()) return next ();

  res.redirect ('/login');
}

function isNotLoggedIn(req,res, next){
  if(!req.isAuthenticated()) return next();
  res.redirect ('/');
}

function renderError(res){
  res.send("Something has gone wrong. Please contact an administrator");
}

async function createSession(res,price,email){
  try{
    const session = await stripe.checkout.sessions.create({
      customer_email: email,
      payment_method_types: ['card'],
      subscription_data: {},
      line_items: [{
        price: price,
        quantity: 1,
      }],
      mode: 'subscription',
      success_url: 'https://juniuscsc.herokuapp.com/?msg=Payment Successful!&paymentMade=yes',
      cancel_url: 'https://juniuscsc.herokuapp.com/',
    }).then(function(response){
      res.json(response.id).send();
    })
  }
  catch(err){
    res.json(null).send();
  }

}

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

function sendViewedData(userID, imageID){
  var request = [];
  request.push(new rqs.AddDetailView(userID, imageID, {'cascadeCreate': true}))
  client.send(new rqs.Batch(request))
}
