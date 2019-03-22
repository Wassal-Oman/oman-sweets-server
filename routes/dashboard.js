// import needed libraries
const path = require("path");
const express = require("express");
const firebase = require("firebase");
const admin = require("firebase-admin");
const { Storage } = require("@google-cloud/storage");
const Multer = require("multer");
const router = express.Router();

// firebase configuration
const config = {
  apiKey: "AIzaSyBsmP3a0vF04Rdw2jS-Aw3BagtQSQ2tsGE",
  authDomain: "omani-sweets.firebaseapp.com",
  databaseURL: "https://omani-sweets.firebaseio.com",
  projectId: "omani-sweets",
  storageBucket: "omani-sweets.appspot.com",
  messagingSenderId: "869738745284"
};

// initialize firebase
firebase.initializeApp(config);

// firebase admin configuration
const adminConfig = require(path.join(__dirname, "ServiceAccountKey"));

// initialize firebase admin
admin.initializeApp({
  credential: admin.credential.cert(adminConfig),
  databaseURL: "https://omani-sweets.firebaseio.com"
});

// firebase database
const db = admin.firestore();

// firebase storage
const storage = new Storage({
  projectId: "omani-sweets",
  keyFilename: path.join(__dirname, "ServiceAccountKey.json")
});

// storage bucket
const bucket = storage.bucket("gs://omani-sweets.appspot.com/");

// multer storage
const multer = Multer({
  storage: Multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

// middleware function to check for logged-in users
const sessionChecker = (req, res, next) => {
  if (!firebase.auth().currentUser) {
    res.redirect("/login");
  } else {
    next();
  }
};

// default
router.get("/", sessionChecker, (req, res) => {
  res.redirect("/home");
});

// login - GET
router.get("/login", (req, res) => {
  if (firebase.auth().currentUser) {
    res.redirect("/home");
  }
  res.render("login");
});

// login - POST
router.post("/login", (req, res) => {
  // get user input
  const { email, password } = req.body;

  // authenticate user
  firebase
    .auth()
    .signInWithEmailAndPassword(email, password)
    .then(data => {
      // get user details
      db.collection("users")
        .doc(data.user.uid)
        .get()
        .then(document => {
          if (document.exists) {
            console.log(document.data());
            if (document.data().type === "Admin") {
              res.redirect("/home");
            } else if (document.data().type === "Deliverer") {
              res.redirect("/delivery");
            } else {
              console.log("Customer is trying to login");
              res.redirect("/logout");
            }
          } else {
            console.log("No User Data");
            res.redirect("/logout");
          }
        })
        .catch(err => {
          console.log(err);
          res.redirect("/500");
        });
    })
    .catch(err => {
      console.log(err);
      res.redirect("/login");
    });
});

// home
router.get("/home", sessionChecker, (req, res) => {
  // render home page
  res.render("home");
});

// users
router.get("/users", sessionChecker, (req, res) => {
  // empty array
  let users = [];

  // get data
  db.collection("users")
    .get()
    .then(snapshot => {
      // load users' data
      snapshot.forEach(doc => {
        users.push(doc.data());
      });

      // render users page
      res.render("users", {
        users
      });
    })
    .catch(err => {
      console.log(err);
      res.redirect("/500");
    });
});

// add user
router.get("/users/add", sessionChecker, (req, res) => {
  res.render("addUser");
});

// store user
router.post("/users/store", sessionChecker, (req, res) => {
  // get inputs
  const { name, email, phone, password, type } = req.body;

  console.log(req.body);

  // create user
  admin
    .auth()
    .createUser({
      email,
      password
    })
    .then(user => {
      console.log(user);

      // store in database
      db.collection("users")
        .doc(user.uid)
        .set({
          id: user.uid,
          name,
          email,
          phone,
          type
        })
        .then(val => {
          console.log(val);
          res.redirect("/users");
        })
        .catch(err => {
          console.log(err);
          res.redirect("/500");
        });
    })
    .catch(err => {
      console.log(err);
      res.redirect("/500");
    });
});

// delete user
router.get("/users/:id/:type/delete", sessionChecker, (req, res) => {
  // get inputs
  const user_id = req.params.id;
  const user_type = req.params.type;

  if (user_type !== "Admin") {
    // delete from auth
    admin
      .auth()
      .deleteUser(user_id)
      .then(val => {
        console.log(val);
        // delete user from database
        db.collection("users")
          .doc(user_id)
          .delete()
          .then(val => {
            console.log(val);
            res.redirect("/users");
          })
          .catch(err => {
            console.log(err);
            res.redirect("/500");
          });
      })
      .catch(err => {
        console.log(err);
        res.redirect("/500");
      });
  } else {
    res.redirect("/users");
  }
});

// orders
router.get("/orders", sessionChecker, (req, res) => {
  // empty array
  let orders = [];

  // get data
  db.collection("orders")
    .get()
    .then(snapshot => {
      // load users' data
      snapshot.forEach(doc => {
        // create an order object
        let order = {
          id: doc.id,
          customer_id: doc.data().customer_id,
          customer_name: doc.data().customer_name,
          customer_phone: doc.data().customer_phone,
          order_date: doc.data().order_date,
          order_time: doc.data().order_time,
          sweet_name: doc.data().sweet_name,
          sweet_price: doc.data().sweet_price,
          sweet_category: doc.data().sweet_category,
          sweet_count: doc.data().sweet_count,
          sweet_image: doc.data().sweet_image
        };

        // push order object to array
        orders.push(order);
      });

      // render users page
      res.render("orders", {
        orders
      });
    })
    .catch(err => {
      console.log(err);
      res.redirect("/500");
    });
});

// delete order
router.get("/orders/:id/delete", sessionChecker, (req, res) => {
  // get order id
  const id = req.params.id;

  // check for id
  if (id) {
    db.collection("orders")
      .doc(id)
      .delete()
      .then(() => {
        console.log("Order deleted successfully");
        res.redirect("/orders");
      })
      .catch(err => {
        console.log(err);
        res.redirect("/orders");
      });
  } else {
    console.log("Order ID is unknown");
    res.redirect("/orders");
  }
});

// sweets
router.get("/sweets", sessionChecker, (req, res) => {
  // empty array
  let sweets = [];

  // get data
  db.collection("products")
    .get()
    .then(snapshot => {
      // load users' data
      snapshot.forEach(doc => {
        sweets.push({
          id: doc.id,
          name: doc.data().name,
          price: doc.data().price,
          category: doc.data().category,
          image: doc.data().image
        });
      });

      // render users page
      res.render("sweets", {
        sweets
      });
    })
    .catch(err => {
      console.log(err);
      res.redirect("/500");
    });
});

// add sweet
router.get("/sweets/add", sessionChecker, (req, res) => {
  res.render("addSweet");
});

// store sweet
router.post(
  "/sweets/store",
  sessionChecker,
  multer.single("file"),
  (req, res) => {
    // get inputs
    const { name, price, category } = req.body;
    const file = req.file;

    if (file) {
      // try uploading the file
      uploadImageToStorage(file)
        .then(link => {
          // add sweet data to firestore
          db.collection("products")
            .doc()
            .set({
              name,
              price,
              category,
              image: link
            })
            .then(val => {
              console.log(val);
              res.redirect("/sweets");
            })
            .catch(err => {
              console.log(err);
              res.redirect("/sweets/add");
            });
        })
        .catch(err => {
          console.log(err);
          res.redirect("/sweets/add");
        });
    } else {
      console.log("No file has been chosen");
      res.redirect("/sweets/add");
    }
  }
);

// delete sweet
router.get("/sweets/:id/delete", sessionChecker, (req, res) => {
  // get id
  const id = req.params.id;

  if (id) {
    db.collection("products")
      .doc(id)
      .delete()
      .then(val => {
        console.log(val);
        res.redirect("/sweets");
      })
      .catch(err => {
        console.log(err);
        res.redirect("/sweets");
      });
  } else {
    console.log("Cannot get document id");
    res.redirect("/sweets");
  }
});

// edit sweet
router.get("/sweets/:name/edit", sessionChecker, (req, res) => {
  // get sweet name
  const name = req.params.name;
  let data = [];

  if (name) {
    // get sweet details
    db.collection("products")
      .where("name", "==", name)
      .get()
      .then(snapshot => {
        if (!snapshot.empty) {
          // fetch all results
          snapshot.forEach(doc => {
            data.push({
              id: doc.id,
              name: doc.data().name,
              price: doc.data().price,
              category: doc.data().category
            });
          });

          // render edit sweet page
          res.render("editSweet", {
            sweet: data[0]
          });
        } else {
          console.log("No data available for this sweet");
          res.redirect("/sweets");
        }
      })
      .catch(err => {
        console.log(err);
        res.redirect("/sweets");
      });
  } else {
    console.log("Cannot get sweet name");
    res.redirect("/sweets");
  }
});

// update sweet
router.post(
  "/sweets/update",
  sessionChecker,
  multer.single("file"),
  (req, res) => {
    // get sweet details
    const { id, name, price, category } = req.body;
    const file = req.file;

    if (file) {
      // try uploading the file
      uploadImageToStorage(file)
        .then(link => {
          // edit sweet data in firestore
          db.collection("products")
            .doc(id)
            .update({
              name,
              price,
              category,
              image: link
            })
            .then(val => {
              console.log(val);
              res.redirect("/sweets");
            })
            .catch(err => {
              console.log(err);
              res.redirect(`/sweets/${name}/edit`);
            });
        })
        .catch(err => {
          console.log(err);
          res.redirect(`/sweets/${name}/edit`);
        });
    } else {
      // edit sweet data in firestore
      db.collection("products")
        .doc(id)
        .update({
          name,
          price,
          category
        })
        .then(val => {
          console.log(val);
          res.redirect("/sweets");
        })
        .catch(err => {
          console.log(err);
          res.redirect(`/sweets/${name}/edit`);
        });
    }
  }
);

// delievrer home
router.get("/delivery", sessionChecker, (req, res) => {
  // empty array
  let orders = [];

  // get data
  db.collection("orders")
    .get()
    .then(snapshot => {
      // load users' data
      snapshot.forEach(doc => {
        orders.push(doc.data());
      });

      // render users page
      res.render("deliveryHome", {
        orders
      });
    })
    .catch(err => {
      console.log(err);
      res.redirect("/500");
    });
});

// logout
router.get("/logout", sessionChecker, (req, res) => {
  firebase.auth().signOut();
  res.redirect("/login");
});

// 500
router.get("/500", (req, res) => {
  res.render("500");
});

/**
 * Function to handle files
 */
const uploadImageToStorage = file => {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject("No image file");
    }

    let newFileName = `${file.originalname}_${Date.now()}`;

    let fileUpload = bucket.file(newFileName);

    const blobStream = fileUpload.createWriteStream({
      metadata: {
        contentType: file.mimetype
      }
    });

    blobStream.on("error", err => {
      reject(err);
    });

    blobStream.on("finish", () => {
      // The public URL can be used to directly access the file via HTTP.
      const url = `https://firebasestorage.googleapis.com/v0/b/omani-sweets.appspot.com/o/${
        fileUpload.name
      }?alt=media`;
      resolve(url);
    });

    blobStream.end(file.buffer);
  });
};

module.exports = router;
