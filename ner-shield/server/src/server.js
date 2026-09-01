import 'dotenv/config'; import http from 'http'; import mongoose from 'mongoose'; import { Server } from 'socket.io'; import { app,setMongooseReady } from './app.js';
const server=http.createServer(app); const io=new Server(server,{cors:{origin:process.env.CLIENT_URL||'http://localhost:5173'}}); app.io=io; io.on('connection',socket=>{socket.emit('dispatch:update',{status:'CONNECTED',message:'Telemetry link established'});});
if(process.env.MONGO_URI) mongoose.connect(process.env.MONGO_URI).then(()=>setMongooseReady(true)).catch(()=>console.log('Mongo unavailable: running demo mode'));
const port=process.env.PORT||5000; server.listen(port,()=>console.log(`NER-SHIELD API listening on ${port}`));
