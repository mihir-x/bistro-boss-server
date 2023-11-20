const express = require('express')
const cors = require('cors')
const jwt = require('jsonwebtoken')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const app = express()
const port = process.env.PORT || 5000

//middleware
app.use(express.json())
app.use(cors())



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.5hh1tg8.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
       
        // await client.connect();

        const menuCollection = client.db('bistroDB').collection('menu')
        const reviewsCollection = client.db('bistroDB').collection('reviews')
        const cartsCollection = client.db('bistroDB').collection('carts')
        const userCollection = client.db('bistroDB').collection('users')
        const paymentCollection = client.db('bistroDB').collection('payments')

        //jwt related api
        app.post('/jwt', async(req,res)=>{
            const user = req.body
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '1h'})
            res.send({token})
        })
        //jwt verification middleware
        const verifyToken = (req, res, next) =>{
            // console.log('inside verify token ', req.headers.authorization)
            if(!req.headers.authorization){
                return res.status(401).send({message: 'unauthorized access'})
            }
            const token = req.headers.authorization.split(' ')[1]
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) =>{
                if(err){
                    return res.status(401).send({message: 'unauthorized access'})
                }
                req.decoded = decoded
                next()
            })
        }
        //use verifyAdmin after verify token
        const verifyAdmin = async(req, res, next) =>{
            const email = req.decoded.email
            const query = { email: email}
            const user = await userCollection.findOne(query)
            const isAdmin = user?.role === 'Admin'
            if(!isAdmin){
                return res.status(403).send({message: 'forbidden access'})
            }
            next()
        }

        //user related api
        app.get('/users',verifyToken, verifyAdmin, async(req, res)=>{
            const result = await userCollection.find().toArray()
            res.send(result)
        })
        app.get('/users/admin/:email',verifyToken, async(req, res)=>{
            const email = req.params.email
            if(email !== req.decoded.email){
                return res.status(403).send({message: 'forbidden access'})
            }
            const query = { email: email}
            const user = await userCollection.findOne(query)
            let admin = false
            if(user){
                admin = user?.role === 'Admin'
            }
            res.send({admin})
        })
        app.post('/users', async(req, res)=>{
            const user = req.body
            //insert email if user doesn't exists
            //different ways to do this(1.make email unique 2.simple checking 3.upsert true)
            const query = {email: user.email}
            const existingUser = await userCollection.findOne(query)
            if(existingUser){
                return res.send({message: 'user already exists in database', insertedId: null})
            }
            const result = await userCollection.insertOne(user)
            res.send(result)
        })
        app.patch('/users/admin/:id', verifyToken, verifyAdmin, async(req, res) =>{
            const id = req.params
            const query = { _id: new ObjectId(id)}
            const updatedDoc = {
                $set: {
                    role: 'Admin'
                }
            }
            const result = await userCollection.updateOne(query, updatedDoc)
            res.send(result)
        })
        app.delete('/users/:id', verifyToken, verifyAdmin, async(req, res) =>{
            const id = req.params
            const query = {
                _id: new ObjectId(id)
            }
            const result = await userCollection.deleteOne(query)
            res.send(result)
        })

        //menu related api
        app.get('/menu', async(req, res)=>{
            const result = await menuCollection.find().toArray()
            res.send(result)
        })

        app.get('/menu/:id', async(req, res) =>{
            const id = req.params.id
            console.log(id)
            const query = {
                _id: id
            }
            const result = await menuCollection.findOne(query)    //something wrong here
            console.log(result)
            res.send(result)
        })

        app.post('/menu',verifyToken, verifyAdmin, async(req, res)=>{
            const item = req.body
            const result = await menuCollection.insertOne(item)
            res.send(result)
        })
        app.patch('/menu/:id', async(req, res) =>{
            const item = req.body
            const id = req.params.id
            const query = { _id: id}
            const updatedDoc = {
                $set: {
                    name: item.name,
                    category: item.category,
                    price: item.price,
                    recipe: item.recipe,
                    image: item.image,
                }
            }
            const result = await menuCollection.updateOne(query, updatedDoc)
            res.send(result)
        })
        app.delete('/menu/:id', verifyToken, verifyAdmin, async(req, res)=>{
            const id = req.params.id
            const query = { _id: new ObjectId(id)}
            const result = await menuCollection.deleteOne(query)
            res.send(result)
        })

        app.get('/reviews', async(req, res)=>{
            const result = await reviewsCollection.find().toArray()
            res.send(result)
        })

        //carts related api
        app.get('/carts', async(req, res)=>{
            const email = req.query.email
            const query = {email: email}
            const result = await cartsCollection.find(query).toArray()
            res.send(result)
        })
        app.post('/carts', async(req, res) =>{
            const cart = req.body
            const result = await cartsCollection.insertOne(cart)
            res.send(result)
        })
        app.delete('/carts/:id', async(req, res)=>{
            const id = req.params.id
            const query = {
                _id: new ObjectId(id)
            }
            const result = await cartsCollection.deleteOne(query)
            res.send(result)
        })


        //payment related api
        app.post('/create-payment-intent', async(req, res) =>{
            const {price} = req.body
            const amount = parseInt(price*100)
            console.log('amount inside the intent: ', amount)
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: [
                    'card'
                ]
            })
            res.send({
                clientSecret: paymentIntent.client_secret
            })
        })
        app.get('/payments/:email',verifyToken, async(req, res) =>{
            const email = req.params.email
            if(req.params.email !== req.decoded.email){
                return res.status(403).send({message: 'Forbidden Access'})
            }
            const query = { email: email}
            const result = await paymentCollection.find(query).toArray()
            res.send(result)
        })
        app.post('/payments', async(req, res) =>{
            const payment = req.body
            const paymentResult = await paymentCollection.insertOne(payment)
            //now carefully delete each item from the cart
            const query = {
                _id: {
                    $in: payment.cartIds.map(id => new ObjectId(id))
                }
            }
            const deleteResult = await cartsCollection.deleteMany(query)
            res.send({paymentResult, deleteResult})
        })

        //stats or analytics related api
        app.get('/admin-stats',verifyToken, verifyAdmin, async(req, res) =>{
            const users = await userCollection.estimatedDocumentCount()
            const menuItems = await menuCollection.estimatedDocumentCount()
            const orders = await paymentCollection.estimatedDocumentCount()

            //this is not the best way to calculate total revenue(bangla system)
            // const payments = await paymentCollection.find().toArray()
            // const revenue = payments?.reduce((total, item) => total + item.price, 0)

            //valo system
            const result = await paymentCollection.aggregate([
                {
                    $group: {
                        _id: null,      //id: null mane shob gula data field, specific id dile specific field er upor operation hobe
                        totalRevenue: {
                            $sum: '$price'
                        }
                    }
                }
            ]).toArray()
            const revenue = result.length>0 ? result[0].totalRevenue : 0

            res.send({
                users, menuItems, orders, revenue,
            })
        })

        //order status


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
    res.send('Bistro Boss server is running')
})
app.listen(port, (req, res) => {
    console.log('Bistro boss server is running on port: ', port)
})
