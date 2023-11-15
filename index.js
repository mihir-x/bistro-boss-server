const express = require('express')
const cors = require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
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

        //user related api
        app.get('/users', async(req, res)=>{
            const result = await userCollection.find().toArray()
            res.send(result)
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
        app.patch('/users/admin/:id', async(req, res) =>{
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
        app.delete('/users/:id', async(req, res) =>{
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
