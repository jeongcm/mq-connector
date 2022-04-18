const dontenv = require('dotenv');
dontenv.config();

const express = require("express");
const app = express();
app.use(express.json());

const MQCOMMM_PORT = process.env.MQCOMMM_PORT || 4001;
const RABBITMQ_SERVER_URL = process.env.RABBITMQ_SERVER_URL || "amqp://localhost";
const RABBITMQ_SERVER_PORT = process.env.RABBITMQ_SERVER_PORT || 5672;
const RABBITMQ_SERVER_QUEUE_NAME = process.env.RABBITMQ_SERVER_QUEUE_NAME || "lari"

const amqp = require("amqplib");
var channel, connection;
const connect_string = RABBITMQ_SERVER_URL + ":" + RABBITMQ_SERVER_PORT;

connectQueue() // call connectQueue function
app.listen(MQCOMMM_PORT, () => console.log("Server running at port " + MQCOMMM_PORT));

async function connectQueue() {
    try {

        connection = await amqp.connect(connect_string);
        channel = await connection.createChannel();
        
        // connect to 'lari', create one if doesnot exist already
        await channel.assertQueue(RABBITMQ_SERVER_QUEUE_NAME);
        console.log("connected queue name:", RABBITMQ_SERVER_QUEUE_NAME);
    } catch (error) {
        console.log("connectQueue error", error);
    }
}

const sendData = async (data) => {
    // send data to queue
    await channel.sendToQueue(RABBITMQ_SERVER_QUEUE_NAME, Buffer.from(JSON.stringify(data)));
    console.log("message sent", Buffer.from(JSON.stringify(data)))    
    // close the channel and connection
    //await channel.close();
    //await connection.close();
}

app.get("/send-msg", (req, res) => {
    const data = {
        title: "Six of Crows",
        author: "Leigh Burdugo"
    };

    try {
        sendData(data);
    }
    catch (error){
        channel.close();
        connection.close();
        console.log("send-msg error", error);
    }

    console.log("A message is sent to queue", data);
    res.send("Message Sent");
    
})

