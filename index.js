const express = require('express');
require('dotenv').config();
const app = express();
const cors = require('cors');
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());



const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.yyjzvb3.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();

        const mealCollection = client.db("SUMealDB").collection('meal');
        const userCollection = client.db("SUMealDB").collection('users');
        const upcomingMealCollection = client.db("SUMealDB").collection('upcomingMeal');

        // JWT related API
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
            res.send({ token });
        });

        // MiddleWares
        const verifyToken = (req, res, next) => {
            console.log('Inside verify Token', req.headers.authorization);
            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'Unauthorized access' });
            }
            const token = req.headers.authorization.split(' ')[1];
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: 'Unauthorized access' });
                }
                req.decoded = decoded;
                next();
            })
        }

        // use verifyAdmin after verifyToken
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            const isAdmin = user?.role === 'admin';
            if (!isAdmin) {
                return res.status(403).send({ message: 'forbidden Access' });
            }

            next();
        }


        // User related API
        app.get('/users', async (req, res) => {
            console.log(req.query);

            let query = {};
            if (req.query?.email) {
                query = { email: req.query.email };
            }
            if (req.query?.name) {
                query = { name: new RegExp(req.query.name, 'i') };
            }

            const result = await userCollection.find(query).toArray();
            res.send(result);
        });

        app.get('/users/admin/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            if (!email === req.decoded.email) {
                return res.status(403).send({ message: 'Forbidden Access' });
            }

            const query = { email: email };
            const user = await userCollection.findOne(query);
            let admin = false;
            if (user) {
                admin = user?.role === 'admin';
            }
            res.send({ admin });
        });


        app.post('/users', async (req, res) => {
            const user = req.body;
            // checking user exist or not
            const query = { email: user.email };
            const existingUser = await userCollection.findOne(query);
            if (existingUser) {
                return res.send({ message: 'user already exist', insertedId: null });
            }

            const result = await userCollection.insertOne(user);
            res.send(result);
        });

        app.patch('/users/admin/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await userCollection.updateOne(filter, updatedDoc);
            res.send(result);
        });

        // meal related apis
        app.get('/meal', async (req, res) => {
            const result = await mealCollection.find().toArray();
            res.send(result);
        });

        app.get('/meal/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await mealCollection.findOne(query);
            res.send(result);
        });

        app.post('/meal', async (req, res) => {
            const mealInfo = req.body;
            const result = await mealCollection.insertOne(mealInfo);
            res.send(result);
        });

        app.patch('/meal/:id', async (req, res) => {
            const item = req.body;
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    title: item.title,
                    category: item.category,
                    image: item.image,
                    ingredients: item.ingredients,
                    description: item.description,
                    price: item.price,
                    rating: item.rating,
                    likes: item.likes,
                    reviews: item.reviews,
                    adminName: item.adminName,
                    adminEmail: item.adminEmail
                }
            }
            const result = await mealCollection.updateOne(filter, updatedDoc);
            res.send(result);
        });

        app.delete('/meal/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await mealCollection.deleteOne(query);
            res.send(result);
        });

        // Upcoming Meal Related API

        app.get('/upcomingMeal', async (req, res) => {
            const result = await upcomingMealCollection.find().toArray();
            res.send(result);
        })

        app.post('/upcomingMeal', async (req, res) => {
            const mealInfo = req.body;
            const result = await upcomingMealCollection.insertOne(mealInfo);
            res.send(result);
        });


        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);




app.get('/', (req, res) => {
    res.send('meals are coming');
});

app.listen(port, () => {
    console.log(`Meals are coming ${port}`);
})