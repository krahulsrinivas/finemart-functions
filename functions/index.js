const functions = require('firebase-functions');
const admin = require('firebase-admin');
const https = require('https');
const PaytmChecksum = require('./PaytmChecksum');
const MongoClient = require('mongodb').MongoClient;

var Message;
admin.initializeApp(functions.config().firebase);
exports.pushNotification = functions.firestore
  .document('orders/{orderId}')
  .onWrite(async (change, context) => {
    var orderid = context.params.orderId;
    var id = await admin.firestore().collection('users').doc(change.after.data().userId).get().then((doc) => {
      return doc.data().token;
    }).catch((e) => {
      console.log(e);
    })
    if (change.after.data().status === 'placed') {
      Message = {
        'notification': {
          'title': 'Your Order has been placed',
          'body': 'Your Order-id is ' + orderid,
          'sound': 'default'
        },
      }
    } else if (change.after.data().status === 'accepted') {
      Message = {
        'notification': {
          'title': 'Your Order has been Accepted and is being packed',
          'body': 'Your Order-id is ' + orderid,
          'sound': 'default'
        },
      }
    } else if (change.after.data().status === 'cancelled') {
      Message = {
        'notification': {
          'title': 'Order Cancelled',
          'body': 'Your Order has been cancelled due to technical issues,Have a good day',
          'sound': 'default'
        },
      }
    } else if (change.after.data().status === 'delivered') {
      Message = {
        'notification': {
          'title': 'Your Order has been Delivered',
          'body': 'Have a good day',
          'sound': 'default'
        },
      }
    }
    return admin.messaging().sendToDevice(id, Message).then((response) =>
      console.log(response)
    ).catch((e) => console.log(e)
    )
  });

exports.addItems = functions.https.onCall(async (data, context) => {
  console.log(data.name);
  const uri = "mongodb+srv://krahulsrinivas:krahul2001@clusterx.liddk.gcp.mongodb.net/Blog?retryWrites=true&w=majority";
  const client = new MongoClient(uri, { useNewUrlParser: true });
  await client.connect().catch((e)=>console.log(e));
  const collection = client.db("Blog").collection("posts");
  await collection.insertOne({"name":data.name,"id":data.id}).catch((e)=>console.log(e));
});

exports.paytm = functions.https.onCall(async (data, context) => {
  var paytmParams = {};
  paytmParams.body = {
    "requestType": "Payment",
    "mid": "OfmBae55853358671790",
    "websiteName": "WEBSTAGING",
    "orderId": `${data['id']}`,
    "callbackUrl": `https://securegw-stage.paytm.in/theia/paytmCallback?ORDER_ID=${data['id']}`,
    "txnAmount": {
      "value": `${data['value']}`,
      "currency": "INR",
    },
    "userInfo": {
      "custId": context.auth.uid,
    },
  };
  console.log(paytmParams);

  // eslint-disable-next-line promise/always-return
  return await PaytmChecksum.generateSignature(JSON.stringify(paytmParams.body), "8dJh1oGnmhe6AbGZ").then((checksum) => {

    paytmParams.head = {
      "signature": checksum
    };

    var post_data = JSON.stringify(paytmParams);

    var options = {

      /* for Staging */
      hostname: 'securegw-stage.paytm.in',

      /* for Production */
      // hostname: 'securegw.paytm.in',

      port: 443,
      path: `/theia/api/v1/initiateTransaction?mid=OfmBae55853358671790&orderId=${data['id']}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': post_data.length
      },
      body: post_data
    };
    console.log(options);
    return options;
  }).catch((error) => {
    console.log(error);
  });
})